"use server";

import { revalidatePath } from "next/cache";
import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import {
  can,
  getPlanGate,
  parsePlanFeatures,
} from "@/features/billing/plan-gate";

import { FREE_PARTNERSHIP_MESSAGE } from "@/features/partnerships/messages";

export type ActionResult = { ok: boolean; message?: string };
export async function createPartnershipAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.administradora],
      roles: [MemberRole.master],
      href: "/app/parcerias",
    });

    const gate = await getPlanGate(session.organizationId);
    if (!can(gate, "partnerships")) {
      return {
        ok: false,
        message: "Parcerias disponíveis apenas no plano Administradora Premium.",
      };
    }

    const supplierOrgId = String(formData.get("supplierOrgId") ?? "");
    if (!supplierOrgId) return { ok: false, message: "Selecione um fornecedor." };

    const supplier = await firestoreDb.organization.findFirst({
      where: { id: supplierOrgId, type: "fornecedor" },
      include: {
        subscriptions: {
          where: { status: "active" },
          include: { plan: true },
          take: 1,
        },
      },
    });
    if (!supplier) return { ok: false, message: "Fornecedor não encontrado." };

    const settings = await firestoreDb.platformSettings.findUnique({ where: { id: "default" } });
    const lockEnabled = settings?.partnershipLockEnabled ?? true;
    const supplierPlan = supplier.subscriptions[0]?.plan;
    const features = parsePlanFeatures(supplierPlan?.featuresJson);
    const isEligible = Boolean(features.partnershipEligible);

    if (lockEnabled && !isEligible) {
      await writeAuditLog({
        userId: session.userId,
        action: "partnership.blocked_free",
        entityType: "organization",
        entityId: supplierOrgId,
      });
      return { ok: false, message: FREE_PARTNERSHIP_MESSAGE };
    }

    await firestoreDb.partnership.upsert({
      where: {
        administradoraOrgId_supplierOrgId: {
          administradoraOrgId: session.organizationId,
          supplierOrgId,
        },
      },
      update: { status: "active", lockedReason: null },
      create: {
        administradoraOrgId: session.organizationId,
        supplierOrgId,
        status: "active",
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "partnership.created",
      entityType: "organization",
      entityId: supplierOrgId,
    });

    revalidatePath("/app/parcerias");
    return { ok: true, message: "Parceiro vinculado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function endPartnershipAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.administradora],
      roles: [MemberRole.master],
      href: "/app/parcerias",
    });

    const partnershipId = String(formData.get("partnershipId") ?? "");
    await firestoreDb.partnership.updateMany({
      where: { id: partnershipId, administradoraOrgId: session.organizationId },
      data: { status: "ended" },
    });
    revalidatePath("/app/parcerias");
    return { ok: true, message: "Parceria encerrada." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function togglePartnershipLockAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAuthorizedSession({
      types: [OrganizationType.master_admin],
      href: "/app/plataforma",
    });

    const enabled = formData.get("enabled") === "true" || formData.get("enabled") === "on";
    await firestoreDb.platformSettings.upsert({
      where: { id: "default" },
      update: { partnershipLockEnabled: enabled },
      create: {
        id: "default",
        partnershipLockEnabled: enabled,
      },
    });
    revalidatePath("/app/plataforma");
    revalidatePath("/app/parcerias");
    return {
      ok: true,
      message: enabled ? "Trava de parceria ativada." : "Trava de parceria desativada.",
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
