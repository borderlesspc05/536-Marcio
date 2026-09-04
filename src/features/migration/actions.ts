"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { createPlanCheckout } from "@/features/billing/subscriptions";

export type ActionResult = { ok: boolean; message?: string };

const PAID_ADM_SLUGS = new Set(["adm-pago", "adm-premium"]);

export async function requestMigrationAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.sindico],
      href: "/app/migracao",
    });

    const planSlug = String(formData.get("planSlug") ?? "");
    if (!planSlug) return { ok: false, message: "Selecione o plano de destino." };

    if (planSlug === "adm-free") {
      await writeAuditLog({
        userId: session.userId,
        action: "migration.blocked_free",
        entityType: "organization",
        entityId: session.organizationId,
      });
      return {
        ok: false,
        message:
          "Migração para Administradora Free não é permitida. Contrate um plano pago intermediário ou Premium.",
      };
    }

    const plan = await firestoreDb.plan.findFirst({
      where: { slug: planSlug, isActive: true, audience: "solicitante" },
    });
    if (!plan || plan.isFree || !PAID_ADM_SLUGS.has(plan.slug)) {
      return {
        ok: false,
        message: "Selecione um plano pago da Administradora (Intermediário ou Premium).",
      };
    }

    const existing = await firestoreDb.organizationMigration.findFirst({
      where: {
        organizationId: session.organizationId,
        status: { in: ["pending_payment", "pending_review"] },
      },
    });
    if (existing) {
      return { ok: false, message: "Já existe uma migração em andamento." };
    }

    const migration = await firestoreDb.organizationMigration.create({
      data: {
        organizationId: session.organizationId,
        fromType: "sindico",
        toType: "administradora",
        targetPlanId: plan.id,
        status: "pending_payment",
        requestedByUserId: session.userId,
      },
    });

    const checkout = await createPlanCheckout({
      organizationId: session.organizationId,
      userId: session.userId,
      planSlug: plan.slug,
      kind: "migration",
      metadata: { migrationId: migration.id },
    });

    await firestoreDb.organizationMigration.update({
      where: { id: migration.id },
      data: { checkoutId: checkout.checkoutId },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "migration.requested",
      entityType: "organization_migration",
      entityId: migration.id,
      metadata: { planSlug: plan.slug },
    });

    if (checkout.checkoutUrl) {
      redirect(checkout.checkoutUrl);
    }
    return { ok: true, message: "Migração iniciada." };
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function reviewMigrationAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.master_admin],
      href: "/app/plataforma/migracoes",
    });

    const migrationId = String(formData.get("migrationId") ?? "");
    const decision = String(formData.get("decision") ?? "");
    const notes = String(formData.get("notes") ?? "") || null;

    const migration = await firestoreDb.organizationMigration.findUnique({
      where: { id: migrationId },
      include: { targetPlan: true },
    });
    if (!migration) return { ok: false, message: "Migração não encontrada." };

    if (decision === "reject") {
      await firestoreDb.organizationMigration.update({
        where: { id: migrationId },
        data: {
          status: "rejected",
          reviewedByUserId: session.userId,
          reviewNotes: notes,
        },
      });
      revalidatePath("/app/plataforma/migracoes");
      return { ok: true, message: "Migração rejeitada." };
    }

    if (migration.targetPlan.isFree) {
      return { ok: false, message: "Não é possível aprovar migração para plano Free." };
    }

    await firestoreDb.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: migration.organizationId },
        data: { type: "administradora" },
      });
      await tx.organizationMigration.update({
        where: { id: migrationId },
        data: {
          status: "approved",
          reviewedByUserId: session.userId,
          reviewNotes: notes ?? "Aprovado pelo Master Admin",
          completedAt: new Date(),
        },
      });
    });

    await writeAuditLog({
      userId: session.userId,
      action: "migration.approved",
      entityType: "organization",
      entityId: migration.organizationId,
    });

    revalidatePath("/app/plataforma/migracoes");
    return { ok: true, message: "Migração aprovada. Dados preservados na organização." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
