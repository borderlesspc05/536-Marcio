"use server";

import { revalidatePath } from "next/cache";
import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { parsePlanFeatures } from "@/features/billing/plan-gate";
import { PARTNERSHIP_UNAVAILABLE_MESSAGE } from "@/features/partnerships/messages";

export type ActionResult = { ok: boolean; message?: string };

async function syncFavoritePriority(input: {
  ownerOrgId: string;
  supplierOrgId: string;
  categoryId: string | null;
  userId: string;
  enable: boolean;
}) {
  const existing = await firestoreDb.favoriteSupplier.findFirst({
    where: {
      ownerOrgId: input.ownerOrgId,
      supplierOrgId: input.supplierOrgId,
    },
  });

  if (!input.enable) {
    if (existing) {
      await firestoreDb.favoriteSupplier.delete({ where: { id: existing.id } });
      await writeAuditLog({
        userId: input.userId,
        action: "favorite.removed",
        entityType: "organization",
        entityId: input.supplierOrgId,
      });
    }
    return;
  }

  if (existing) {
    await firestoreDb.favoriteSupplier.update({
      where: { id: existing.id },
      data: { categoryId: input.categoryId },
    });
  } else {
    await firestoreDb.favoriteSupplier.create({
      data: {
        ownerOrgId: input.ownerOrgId,
        supplierOrgId: input.supplierOrgId,
        categoryId: input.categoryId,
      },
    });
  }
  await writeAuditLog({
    userId: input.userId,
    action: "favorite.added",
    entityType: "organization",
    entityId: input.supplierOrgId,
    metadata: { categoryId: input.categoryId, via: "partnership" },
  });
}

export async function createPartnershipAction(formData: FormData): Promise<ActionResult> {
  try {
    const { requireCapability } = await import("@/lib/auth/capability");
    const { session } = await requireCapability({
      types: [OrganizationType.administradora],
      roles: [MemberRole.master],
      href: "/app/parcerias",
      feature: "partnerships",
      featureMessage: "Parcerias disponíveis apenas no plano Administradora Premium.",
    });

    const supplierOrgId = String(formData.get("supplierOrgId") ?? "");
    const categoryId = String(formData.get("categoryId") || "") || null;
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
      return { ok: false, message: PARTNERSHIP_UNAVAILABLE_MESSAGE };
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

    // Prioridade 1 no motor = favorito (categoria opcional + plano pago)
    await syncFavoritePriority({
      ownerOrgId: session.organizationId,
      supplierOrgId,
      categoryId,
      userId: session.userId,
      enable: true,
    });

    await writeAuditLog({
      userId: session.userId,
      action: "partnership.created",
      entityType: "organization",
      entityId: supplierOrgId,
      metadata: { categoryId },
    });

    revalidatePath("/app/parcerias");
    return {
      ok: true,
      message: categoryId
        ? "Parceiro vinculado com prioridade 1 na categoria selecionada."
        : "Parceiro vinculado com prioridade 1 no motor de distribuição.",
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function endPartnershipAction(formData: FormData): Promise<ActionResult> {
  try {
    const { requireCapability } = await import("@/lib/auth/capability");
    const { session } = await requireCapability({
      types: [OrganizationType.administradora],
      roles: [MemberRole.master],
      href: "/app/parcerias",
      feature: "partnerships",
      featureMessage: "Parcerias disponíveis apenas no plano Administradora Premium.",
    });

    const partnershipId = String(formData.get("partnershipId") ?? "");
    const existing = await firestoreDb.partnership.findFirst({
      where: { id: partnershipId, administradoraOrgId: session.organizationId },
    });
    if (!existing) return { ok: false, message: "Parceria não encontrada." };

    await firestoreDb.partnership.updateMany({
      where: { id: partnershipId, administradoraOrgId: session.organizationId },
      data: { status: "ended" },
    });

    await syncFavoritePriority({
      ownerOrgId: session.organizationId,
      supplierOrgId: existing.supplierOrgId,
      categoryId: null,
      userId: session.userId,
      enable: false,
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
