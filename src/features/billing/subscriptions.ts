import { createHash, randomUUID } from "crypto";
import type { Plan, Subscription } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { writeAuditLog } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { getPaymentProvider } from "@/features/billing/payment-provider";
import { calculateProrationCents } from "@/features/billing/money";
import { isPlanAvailableForOrganization } from "@/features/billing/plan-catalog";

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function yearMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function getCheckoutCustomer(organizationId: string, userId: string) {
  const [organization, user] = await Promise.all([
    firestoreDb.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    firestoreDb.user.findUniqueOrThrow({ where: { id: userId } }),
  ]);
  return {
    name: organization.name,
    document: organization.document ?? "",
    email: user.email,
    phone: null,
  };
}

export function makeIdempotencyKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40);
}

export async function getActiveSubscription(organizationId: string) {
  return firestoreDb.subscription.findFirst({
    where: { organizationId, status: { in: ["active", "past_due"] } },
    include: { plan: true, pendingPlan: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function applyPendingDowngrades(): Promise<number> {
  const now = new Date();
  const due = await firestoreDb.subscription.findMany({
    where: {
      cancelAtPeriodEnd: true,
      pendingPlanId: { not: null },
      currentPeriodEnd: { lte: now },
      status: "active",
    },
    include: { plan: true, pendingPlan: true },
  });

  for (const sub of due) {
    if (!sub.pendingPlanId || !sub.pendingPlan) continue;
    await activatePlanChange({
      organizationId: sub.organizationId,
      toPlanId: sub.pendingPlanId,
      changeType: "downgrade_effective",
      userId: null,
      immediate: true,
      subscription: sub,
    });
  }
  return due.length;
}

export async function activatePlanChange(input: {
  organizationId: string;
  toPlanId: string;
  changeType: string;
  userId: string | null;
  immediate: boolean;
  subscription?: (Subscription & { plan: Plan; pendingPlan: Plan | null }) | null;
  checkoutId?: string;
  prorationCents?: number;
}) {
  const toPlan = await firestoreDb.plan.findUniqueOrThrow({ where: { id: input.toPlanId } });
  const current =
    input.subscription ??
    (await firestoreDb.subscription.findFirst({
      where: { organizationId: input.organizationId },
      include: { plan: true, pendingPlan: true },
      orderBy: { createdAt: "desc" },
    }));

  const now = new Date();
  const periodEnd = addMonths(now, 1);

  if (
    !input.immediate &&
    current &&
    current.plan.priceCents > toPlan.priceCents
  ) {
    // Downgrade: agenda para fim do ciclo (inclui Free)
    await firestoreDb.subscription.update({
      where: { id: current.id },
      data: {
        cancelAtPeriodEnd: true,
        pendingPlanId: toPlan.id,
        currentPeriodEnd: current.currentPeriodEnd ?? periodEnd,
      },
    });
    await firestoreDb.subscriptionChange.create({
      data: {
        organizationId: input.organizationId,
        fromPlanId: current.planId,
        toPlanId: toPlan.id,
        changeType: "downgrade_scheduled",
        effectiveAt: current.currentPeriodEnd ?? periodEnd,
        checkoutId: input.checkoutId,
        prorationCents: input.prorationCents ?? 0,
        notes: "Efetiva no fim do ciclo",
      },
    });
    await writeAuditLog({
      userId: input.userId,
      action: "subscription.downgrade_scheduled",
      entityType: "organization",
      entityId: input.organizationId,
      metadata: { toPlan: toPlan.slug, effectiveAt: current.currentPeriodEnd ?? periodEnd },
    });
    return { status: "scheduled" as const, plan: toPlan };
  }

  const periodStart = current?.currentPeriodStart ?? now;
  const existingPeriodEnd = current?.currentPeriodEnd ?? periodEnd;
  const prorationCents =
    input.prorationCents ??
    (current
      ? calculateProrationCents({
          fromPriceCents: current.plan.priceCents,
          toPriceCents: toPlan.priceCents,
          periodStart,
          periodEnd: existingPeriodEnd,
          asOf: now,
        })
      : 0);

  // Upgrade / free / activate immediate
  if (current) {
    await firestoreDb.subscription.update({
      where: { id: current.id },
      data: {
        planId: toPlan.id,
        status: "active",
        startsAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        pendingPlanId: null,
        endsAt: null,
      },
    });
  } else {
    await firestoreDb.subscription.create({
      data: {
        organizationId: input.organizationId,
        planId: toPlan.id,
        status: "active",
        startsAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
  }

  await firestoreDb.subscriptionChange.create({
    data: {
      organizationId: input.organizationId,
      fromPlanId: current?.planId ?? null,
      toPlanId: toPlan.id,
      changeType: input.changeType,
      effectiveAt: now,
      checkoutId: input.checkoutId,
      prorationCents,
    },
  });

  await writeAuditLog({
    userId: input.userId,
    action: "subscription.activated",
    entityType: "organization",
    entityId: input.organizationId,
    metadata: { plan: toPlan.slug, changeType: input.changeType },
  });

  await firestoreDb.domainEvent.create({
    data: {
      type: "subscription.activated",
      entityType: "organization",
      entityId: input.organizationId,
      organizationId: input.organizationId,
      payload: JSON.stringify({ planSlug: toPlan.slug, changeType: input.changeType }),
    },
  });

  const { notifyAfterDomainEvent } = await import("@/features/notifications/notify-after");
  await notifyAfterDomainEvent({
    type: "subscription.activated",
    entityType: "organization",
    entityId: input.organizationId,
    organizationId: input.organizationId,
    payload: { planSlug: toPlan.slug, changeType: input.changeType, organizationId: input.organizationId },
  });

  return { status: "active" as const, plan: toPlan };
}

export async function createPlanCheckout(input: {
  organizationId: string;
  userId: string;
  planSlug: string;
  kind?: "plan" | "migration";
  metadata?: Record<string, unknown>;
}) {
  await applyPendingDowngrades();

  const [plan, org, current] = await Promise.all([
    firestoreDb.plan.findFirst({
      where: { slug: input.planSlug, isActive: true },
    }),
    firestoreDb.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
    }),
    getActiveSubscription(input.organizationId),
  ]);
  if (!plan) throw new AppError("Plano não encontrado.");

  if (
    input.kind !== "migration" &&
    !isPlanAvailableForOrganization(org.type, plan.slug)
  ) {
    throw new AppError(
      "Este plano não está disponível para o perfil da sua organização.",
    );
  }

  if (input.kind !== "migration" && current?.planId === plan.id) {
    return {
      checkoutId: null as string | null,
      checkoutUrl: "/app/meu-plano?current=1",
      activated: true as const,
      scheduled: false as const,
      plan,
      result: { status: "already_active" as const, plan },
    };
  }

  if (!plan.isFree && plan.priceCents === 0) {
    throw new AppError("Este plano é contratado com uma proposta comercial personalizada.");
  }

  const isUpgrade =
    !current ||
    plan.priceCents > current.plan.priceCents ||
    (current.plan.isFree && !plan.isFree);

  // Free → ativa sem gateway (upgrade) ou agenda downgrade
  if (plan.isFree && plan.priceCents === 0) {
    if (input.kind === "migration") {
      throw new Error("Migração para Administradora Free não é permitida.");
    }
    const result = await activatePlanChange({
      organizationId: input.organizationId,
      toPlanId: plan.id,
      changeType: isUpgrade ? "upgrade_free" : "downgrade_free",
      userId: input.userId,
      immediate: isUpgrade,
    });
    return {
      checkoutId: null as string | null,
      checkoutUrl: isUpgrade
        ? "/app/meu-plano?activated=1"
        : "/app/meu-plano?downgrade=scheduled",
      activated: result.status === "active",
      scheduled: result.status === "scheduled",
      plan,
      result,
    };
  }

  // Downgrade pago → agenda sem cobrança imediata
  if (current && !isUpgrade && plan.priceCents < current.plan.priceCents) {
    const result = await activatePlanChange({
      organizationId: input.organizationId,
      toPlanId: plan.id,
      changeType: "downgrade_scheduled",
      userId: input.userId,
      immediate: false,
    });
    return {
      checkoutId: null as string | null,
      checkoutUrl: "/app/meu-plano?downgrade=scheduled",
      activated: false as const,
      scheduled: true as const,
      plan,
      result,
    };
  }

  const idempotencyKey = makeIdempotencyKey([
    input.organizationId,
    plan.id,
    input.kind ?? "plan",
    yearMonth(),
    randomUUID(),
  ]);

  const checkout = await firestoreDb.paymentCheckout.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      kind: input.kind === "migration" ? "migration" : "plan",
      planId: plan.id,
      status: "pending",
      amountCents: plan.priceCents,
      idempotencyKey,
      metadataJson: JSON.stringify({
        planSlug: plan.slug,
        orgType: org.type,
        ...(input.metadata ?? {}),
      }),
    },
  });

  const provider = getPaymentProvider();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const customer = await getCheckoutCustomer(input.organizationId, input.userId);
  const session = await provider.createCheckout({
    amountCents: plan.priceCents,
    description: `Assinatura ${plan.name}`,
    organizationId: input.organizationId,
    checkoutId: checkout.id,
    idempotencyKey,
    successUrl: `${base}/checkout/sucesso?checkout=${checkout.id}`,
    cancelUrl: `${base}/checkout?plan=${plan.slug}&canceled=1`,
    recurring: true,
    customer,
  });

  await firestoreDb.paymentCheckout.update({
    where: { id: checkout.id },
    data: { externalId: session.externalId, provider: session.provider },
  });

  // Marca subscription como pending até webhook
  if (current) {
    await firestoreDb.subscription.update({
      where: { id: current.id },
      data: { status: current.status === "active" ? "active" : "pending" },
    });
  } else {
    await firestoreDb.subscription.create({
      data: {
        organizationId: input.organizationId,
        planId: plan.id,
        status: "pending",
      },
    });
  }

  await writeAuditLog({
    userId: input.userId,
    action: "checkout.created",
    entityType: "payment_checkout",
    entityId: checkout.id,
    metadata: { planSlug: plan.slug, amountCents: plan.priceCents },
  });

  return {
    checkoutId: checkout.id,
    checkoutUrl: session.checkoutUrl,
    activated: false as const,
    plan,
  };
}

export async function createCategoryAddonCheckout(input: {
  organizationId: string;
  userId: string;
  quantity: number;
  categoryIds: string[];
}) {
  if (input.quantity < 1) throw new Error("Quantidade inválida.");
  if (input.categoryIds.length !== input.quantity) {
    throw new Error("Selecione exatamente a quantidade de categorias.");
  }

  const settings = await firestoreDb.platformSettings.findUnique({ where: { id: "default" } });
  const unitPrice = settings?.categoryAddonPriceCents ?? 2900;
  const total = unitPrice * input.quantity;

  const idempotencyKey = makeIdempotencyKey([
    input.organizationId,
    "addon",
    input.categoryIds.sort().join(","),
    randomUUID(),
  ]);

  const checkout = await firestoreDb.paymentCheckout.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      kind: "category_addon",
      status: "pending",
      amountCents: total,
      quantity: input.quantity,
      idempotencyKey,
      metadataJson: JSON.stringify({
        categoryIds: input.categoryIds,
        unitPriceCents: unitPrice,
      }),
    },
  });

  await firestoreDb.categoryAddonPurchase.create({
    data: {
      organizationId: input.organizationId,
      quantity: input.quantity,
      unitPriceCents: unitPrice,
      totalCents: total,
      checkoutId: checkout.id,
      status: "pending",
    },
  });

  const provider = getPaymentProvider();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const customer = await getCheckoutCustomer(input.organizationId, input.userId);
  const session = await provider.createCheckout({
    amountCents: total,
    description: `Categorias adicionais × ${input.quantity}`,
    organizationId: input.organizationId,
    checkoutId: checkout.id,
    idempotencyKey,
    successUrl: `${base}/checkout/sucesso?checkout=${checkout.id}`,
    cancelUrl: `${base}/app/meu-plano?addon=canceled`,
    customer,
  });

  await firestoreDb.paymentCheckout.update({
    where: { id: checkout.id },
    data: { externalId: session.externalId, provider: session.provider },
  });

  return { checkoutId: checkout.id, checkoutUrl: session.checkoutUrl, unitPrice, total };
}

/**
 * Cobrança personalizada (VIP / banner / campanhas) — fatura valor livre
 * sem alterar a lógica de features do produto.
 */
export async function createCustomBillingCheckout(input: {
  organizationId: string;
  userId: string;
  amountCents: number;
  description: string;
  planSlug?: string | null;
}) {
  if (!Number.isFinite(input.amountCents) || input.amountCents < 1) {
    throw new Error("Valor inválido para cobrança personalizada.");
  }
  const description = input.description.trim();
  if (!description) throw new Error("Descrição obrigatória.");

  let planId: string | null = null;
  if (input.planSlug) {
    const plan = await firestoreDb.plan.findFirst({
      where: { slug: input.planSlug, isActive: true },
    });
    if (!plan) throw new Error("Plano de referência não encontrado.");
    planId = plan.id;
  }

  const idempotencyKey = makeIdempotencyKey([
    input.organizationId,
    "custom",
    String(input.amountCents),
    description,
    randomUUID(),
  ]);

  const checkout = await firestoreDb.paymentCheckout.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      kind: "custom",
      planId,
      status: "pending",
      amountCents: input.amountCents,
      idempotencyKey,
      metadataJson: JSON.stringify({
        description,
        planSlug: input.planSlug ?? null,
        billingKind: "custom_addon",
      }),
    },
  });

  const provider = getPaymentProvider();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const customer = await getCheckoutCustomer(input.organizationId, input.userId);
  const session = await provider.createCheckout({
    amountCents: input.amountCents,
    description,
    organizationId: input.organizationId,
    checkoutId: checkout.id,
    idempotencyKey,
    successUrl: `${base}/checkout/sucesso?checkout=${checkout.id}`,
    cancelUrl: `${base}/app/plataforma?custom=canceled`,
    customer,
  });

  await firestoreDb.paymentCheckout.update({
    where: { id: checkout.id },
    data: { externalId: session.externalId, provider: session.provider },
  });

  await writeAuditLog({
    userId: input.userId,
    action: "billing.custom_checkout_created",
    entityType: "payment_checkout",
    entityId: checkout.id,
    metadata: {
      organizationId: input.organizationId,
      amountCents: input.amountCents,
      description,
      planSlug: input.planSlug ?? null,
    },
  });

  return { checkoutId: checkout.id, checkoutUrl: session.checkoutUrl };
}

export async function fulfillCheckoutPaid(checkoutId: string, userId?: string | null) {
  const checkout = await firestoreDb.paymentCheckout.findUnique({
    where: { id: checkoutId },
    include: { plan: true },
  });
  if (!checkout) throw new Error("Checkout não encontrado.");
  if (checkout.status === "paid") {
    // Assinaturas Asaas reutilizam o mesmo checkout externo em todos os ciclos.
    // Um novo pagamento confirmado reativa a conta após eventual inadimplência.
    if (checkout.provider === "asaas" && checkout.kind === "plan") {
      const now = new Date();
      await firestoreDb.subscription.updateMany({
        where: { organizationId: checkout.organizationId },
        data: {
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: addMonths(now, 1),
        },
      });
    }
    return { alreadyProcessed: true as const, checkout };
  }

  await firestoreDb.paymentCheckout.update({
    where: { id: checkout.id },
    data: { status: "paid", paidAt: new Date() },
  });

  const metadata = JSON.parse(checkout.metadataJson || "{}") as {
    categoryIds?: string[];
    migrationId?: string;
    unitPriceCents?: number;
    description?: string;
  };

  if (checkout.kind === "custom") {
    await writeAuditLog({
      userId: userId ?? checkout.userId,
      action: "billing.custom_checkout_paid",
      entityType: "payment_checkout",
      entityId: checkout.id,
      metadata: {
        organizationId: checkout.organizationId,
        amountCents: checkout.amountCents,
        description: metadata.description ?? null,
        planId: checkout.planId,
      },
    });
    return { alreadyProcessed: false as const, checkout };
  }

  if (checkout.kind === "plan" || checkout.kind === "migration") {
    if (!checkout.planId) throw new Error("Checkout sem plano.");
    await activatePlanChange({
      organizationId: checkout.organizationId,
      toPlanId: checkout.planId,
      changeType: checkout.kind === "migration" ? "migration_upgrade" : "upgrade",
      userId: userId ?? checkout.userId,
      immediate: true,
      checkoutId: checkout.id,
    });
  }

  if (checkout.kind === "migration" && metadata.migrationId) {
    await completeMigrationAfterPayment(metadata.migrationId, userId ?? checkout.userId);
  }

  if (checkout.kind === "category_addon") {
    const categoryIds = metadata.categoryIds ?? [];
    const unitPrice = metadata.unitPriceCents ?? Math.round(checkout.amountCents / checkout.quantity);
    for (const categoryId of categoryIds) {
      const firstSegment = await firestoreDb.serviceItem.findFirst({
        where: { categoryId, deletedAt: null, isActive: true },
        orderBy: { sortOrder: "asc" },
      });
      if (!firstSegment) continue;

      const existing = await firestoreDb.organizationCategory.findFirst({
        where: {
          organizationId: checkout.organizationId,
          categoryId,
          serviceItemId: firstSegment.id,
        },
      });
      if (existing) {
        await firestoreDb.organizationCategory.update({
          where: { id: existing.id },
          data: {
            isAddon: true,
            isIncluded: false,
            unitPriceCents: unitPrice,
            checkoutId: checkout.id,
          },
        });
      } else {
        await firestoreDb.organizationCategory.create({
          data: {
            organizationId: checkout.organizationId,
            categoryId,
            serviceItemId: firstSegment.id,
            isAddon: true,
            isIncluded: false,
            unitPriceCents: unitPrice,
            checkoutId: checkout.id,
          },
        });
      }
    }
    await firestoreDb.categoryAddonPurchase.updateMany({
      where: { checkoutId: checkout.id },
      data: { status: "paid" },
    });
  }

  await writeAuditLog({
    userId: userId ?? checkout.userId,
    action: "checkout.paid",
    entityType: "payment_checkout",
    entityId: checkout.id,
    metadata: { kind: checkout.kind, amountCents: checkout.amountCents },
  });

  await firestoreDb.domainEvent.create({
    data: {
      type: "checkout.paid",
      entityType: "payment_checkout",
      entityId: checkout.id,
      organizationId: checkout.organizationId,
      payload: checkout.metadataJson,
    },
  });

  return { alreadyProcessed: false as const, checkout };
}

export async function markCheckoutFailed(checkoutId: string, status: "failed" | "canceled" | "past_due") {
  const checkout = await firestoreDb.paymentCheckout.findUnique({ where: { id: checkoutId } });
  if (!checkout) return checkout;

  // O checkout de uma assinatura recorrente já fica "paid" após o primeiro
  // ciclo, mas cobranças futuras vencidas ainda devem bloquear o plano.
  if (checkout.status === "paid") {
    if (status === "past_due" && checkout.provider === "asaas") {
      await firestoreDb.subscription.updateMany({
        where: { organizationId: checkout.organizationId, status: "active" },
        data: { status: "past_due" },
      });
    }
    return checkout;
  }

  await firestoreDb.paymentCheckout.update({
    where: { id: checkoutId },
    data: {
      status: status === "past_due" ? "failed" : status,
      failedAt: new Date(),
    },
  });

  if (status === "past_due") {
    await firestoreDb.subscription.updateMany({
      where: { organizationId: checkout.organizationId, status: "active" },
      data: { status: "past_due" },
    });
  }

  await writeAuditLog({
    action: `checkout.${status}`,
    entityType: "payment_checkout",
    entityId: checkoutId,
  });

  return checkout;
}

async function completeMigrationAfterPayment(migrationId: string, userId?: string | null) {
  const migration = await firestoreDb.organizationMigration.findUnique({
    where: { id: migrationId },
    include: { targetPlan: true },
  });
  if (!migration) return;
  if (migration.status === "approved") return;

  if (migration.targetPlan.isFree) {
    await firestoreDb.organizationMigration.update({
      where: { id: migration.id },
      data: { status: "rejected", reviewNotes: "Bloqueado: plano Free" },
    });
    throw new Error("Migração para Administradora Free é impossível.");
  }

  await firestoreDb.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: migration.organizationId },
      data: { type: "administradora" },
    });
    await tx.organizationMigration.update({
      where: { id: migration.id },
      data: {
        status: "approved",
        completedAt: new Date(),
        reviewedByUserId: userId,
        reviewNotes: "Auto-aprovado após pagamento",
      },
    });
  });

  await writeAuditLog({
    userId,
    action: "migration.completed",
    entityType: "organization",
    entityId: migration.organizationId,
    metadata: { fromType: migration.fromType, plan: migration.targetPlan.slug },
  });

  if (userId) {
    try {
      const { buildSessionForUser, createSessionToken, setSessionCookie } = await import(
        "@/lib/auth/session"
      );
      const payload = await buildSessionForUser(userId);
      if (payload) {
        await setSessionCookie(await createSessionToken(payload));
      }
    } catch {
      // sessão será atualizada no próximo login
    }
  }
}

export { yearMonth, addMonths };
