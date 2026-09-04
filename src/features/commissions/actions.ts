"use server";

import { revalidatePath } from "next/cache";
import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { z } from "zod";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { can, getPlanGate } from "@/features/billing/plan-gate";
import { yearMonth } from "@/features/billing/subscriptions";

export type ActionResult = { ok: boolean; message?: string };

const agreementSchema = z.object({
  supplierOrgId: z.string().min(1),
  feeType: z.enum(["fixed", "percent"]),
  feeValue: z.coerce.number().positive(),
  durationMonths: z.coerce.number().int().min(1).max(12).optional(),
  isRecurring: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

export async function createCommissionAgreementAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.administradora],
      roles: [MemberRole.master],
      href: "/app/financeiro",
    });

    const gate = await getPlanGate(session.organizationId);
    if (!can(gate, "commissions")) {
      return { ok: false, message: "Comissões disponíveis no plano Premium." };
    }

    const parsed = agreementSchema.safeParse({
      supplierOrgId: formData.get("supplierOrgId"),
      feeType: formData.get("feeType"),
      feeValue: formData.get("feeValue"),
      durationMonths: formData.get("durationMonths") || undefined,
      isRecurring: formData.get("isRecurring") === "on" || formData.get("isRecurring") === "true",
      notes: formData.get("notes") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    if (parsed.data.feeType === "percent" && parsed.data.feeValue > 100) {
      return { ok: false, message: "Percentual máximo: 100%." };
    }

    const endsAt =
      parsed.data.isRecurring || !parsed.data.durationMonths
        ? null
        : new Date(Date.now() + parsed.data.durationMonths * 30 * 86400000);

    await firestoreDb.commissionAgreement.create({
      data: {
        administradoraOrgId: session.organizationId,
        supplierOrgId: parsed.data.supplierOrgId,
        feeType: parsed.data.feeType,
        feeValue: parsed.data.feeValue,
        durationMonths: parsed.data.durationMonths ?? null,
        isRecurring: Boolean(parsed.data.isRecurring),
        endsAt,
        notes: parsed.data.notes ?? null,
        createdByUserId: session.userId,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "commission.agreement_created",
      entityType: "organization",
      entityId: parsed.data.supplierOrgId,
    });

    revalidatePath("/app/financeiro");
    return { ok: true, message: "Acordo de comissão cadastrado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function createCommissionAgreementFormAction(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return createCommissionAgreementAction(formData);
}

export async function updateCommissionAgreementFormAction(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return updateCommissionAgreementAction(formData);
}

export async function updateCommissionAgreementAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.administradora],
      roles: [MemberRole.master],
      href: "/app/financeiro",
    });

    const gate = await getPlanGate(session.organizationId);
    if (!can(gate, "commissions")) {
      return { ok: false, message: "Comissões disponíveis no plano Premium." };
    }

    const id = String(formData.get("id") ?? "");
    const feeType = String(formData.get("feeType") ?? "");
    const feeValue = Number(formData.get("feeValue"));
    if (!id || !["fixed", "percent"].includes(feeType) || !Number.isFinite(feeValue) || feeValue <= 0) {
      return { ok: false, message: "Dados inválidos para edição." };
    }

    const agreement = await firestoreDb.commissionAgreement.findFirst({
      where: { id, administradoraOrgId: session.organizationId },
    });
    if (!agreement) return { ok: false, message: "Acordo não encontrado." };

    await firestoreDb.commissionAgreement.update({
      where: { id },
      data: {
        feeType: feeType as "fixed" | "percent",
        feeValue,
        notes: String(formData.get("notes") || agreement.notes || "") || null,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "commission.agreement_updated",
      entityType: "commission_agreement",
      entityId: id,
      metadata: { feeType, feeValue },
    });

    revalidatePath("/app/financeiro");
    revalidatePath("/app");
    return { ok: true, message: "Acordo atualizado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function deleteCommissionAgreementFormAction(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return deleteCommissionAgreementAction(formData);
}

export async function deleteCommissionAgreementAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.administradora],
      roles: [MemberRole.master],
      href: "/app/financeiro",
    });

    const gate = await getPlanGate(session.organizationId);
    if (!can(gate, "commissions")) {
      return { ok: false, message: "Comissões disponíveis no plano Premium." };
    }

    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, message: "Acordo inválido." };

    const agreement = await firestoreDb.commissionAgreement.findFirst({
      where: { id, administradoraOrgId: session.organizationId },
    });
    if (!agreement) return { ok: false, message: "Acordo não encontrado." };

    await firestoreDb.commissionAgreement.delete({ where: { id } });

    await writeAuditLog({
      userId: session.userId,
      action: "commission.agreement_deleted",
      entityType: "commission_agreement",
      entityId: id,
    });

    revalidatePath("/app/financeiro");
    revalidatePath("/app");
    return { ok: true, message: "Acordo excluído." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

/** Hook pós quotation.approved — alimenta ledger de expectativa de receita. */
export async function recordCommissionFromApproval(input: {
  administradoraOrgId: string;
  supplierOrgId: string;
  quotationId: string;
  proposalId: string;
  conditionId: string;
  volumeCents: number;
  categoryId?: string | null;
}) {
  const org = await firestoreDb.organization.findUnique({
    where: { id: input.administradoraOrgId },
  });
  if (!org || org.type !== "administradora") return null;

  const gate = await getPlanGate(input.administradoraOrgId);
  if (!can(gate, "commissions")) return null;

  const agreement = await firestoreDb.commissionAgreement.findFirst({
    where: {
      administradoraOrgId: input.administradoraOrgId,
      supplierOrgId: input.supplierOrgId,
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!agreement) return null;

  const commissionCents =
    agreement.feeType === "fixed"
      ? Math.round(agreement.feeValue * 100)
      : Math.round((input.volumeCents * agreement.feeValue) / 100);

  const entry = await firestoreDb.commissionEntry.create({
    data: {
      agreementId: agreement.id,
      administradoraOrgId: input.administradoraOrgId,
      supplierOrgId: input.supplierOrgId,
      quotationId: input.quotationId,
      proposalId: input.proposalId,
      conditionId: input.conditionId,
      categoryId: input.categoryId ?? null,
      volumeCents: input.volumeCents,
      commissionCents,
      yearMonth: yearMonth(),
      status: "expected",
      notes: "Gerado após aprovação de cotação",
    },
  });

  await firestoreDb.domainEvent.create({
    data: {
      type: "commission.expected",
      entityType: "commission_entry",
      entityId: entry.id,
      organizationId: input.administradoraOrgId,
      payload: JSON.stringify({
        commissionCents,
        volumeCents: input.volumeCents,
        quotationId: input.quotationId,
        administradoraOrgId: input.administradoraOrgId,
        supplierOrgId: input.supplierOrgId,
      }),
    },
  });

  const { notifyAfterDomainEvent } = await import("@/features/notifications/notify-after");
  await notifyAfterDomainEvent({
    type: "commission.expected",
    entityType: "commission_entry",
    entityId: entry.id,
    organizationId: input.administradoraOrgId,
    payload: {
      commissionCents,
      volumeCents: input.volumeCents,
      quotationId: input.quotationId,
      administradoraOrgId: input.administradoraOrgId,
      supplierOrgId: input.supplierOrgId,
    },
  });

  return entry;
}
