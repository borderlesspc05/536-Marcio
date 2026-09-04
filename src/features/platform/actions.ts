"use server";

import { revalidatePath } from "next/cache";
import { OrganizationType } from "@/lib/domain/types";
import { z } from "zod";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";

export type ActionResult = { ok: boolean; message?: string };

const settingsSchema = z.object({
  freeQuotaSolicitante: z.coerce.number().int().min(0).max(9999),
  freeQuotaFornecedor: z.coerce.number().int().min(0).max(9999),
  supplierProQuota: z.coerce.number().int().min(0).max(9999),
  supplierPremiumQuota: z.coerce.number().int().min(0).max(9999),
  categoryAddonPriceCents: z.coerce.number().int().min(0),
  reminderDays: z.string().min(3),
  partnershipLockEnabled: z.boolean(),
});

export async function updatePlatformSettingsAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.master_admin],
      href: "/app/plataforma",
    });

    const reminderRaw = String(formData.get("reminderDays") ?? "5,10")
      .split(/[,\s]+/)
      .map((item) => Number(item.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    const parsed = settingsSchema.safeParse({
      freeQuotaSolicitante: formData.get("freeQuotaSolicitante"),
      freeQuotaFornecedor: formData.get("freeQuotaFornecedor"),
      supplierProQuota: formData.get("supplierProQuota"),
      supplierPremiumQuota: formData.get("supplierPremiumQuota"),
      categoryAddonPriceCents: Math.round(Number(formData.get("categoryAddonPrice")) * 100),
      reminderDays: JSON.stringify(reminderRaw.length ? reminderRaw : [5, 10]),
      partnershipLockEnabled:
        formData.get("partnershipLockEnabled") === "on" ||
        formData.get("partnershipLockEnabled") === "true",
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    await firestoreDb.platformSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        freeQuotaSolicitante: parsed.data.freeQuotaSolicitante,
        freeQuotaFornecedor: parsed.data.freeQuotaFornecedor,
        supplierProQuota: parsed.data.supplierProQuota,
        supplierPremiumQuota: parsed.data.supplierPremiumQuota,
        categoryAddonPriceCents: parsed.data.categoryAddonPriceCents,
        reminderDaysJson: parsed.data.reminderDays,
        partnershipLockEnabled: parsed.data.partnershipLockEnabled,
      },
      update: {
        freeQuotaSolicitante: parsed.data.freeQuotaSolicitante,
        freeQuotaFornecedor: parsed.data.freeQuotaFornecedor,
        supplierProQuota: parsed.data.supplierProQuota,
        supplierPremiumQuota: parsed.data.supplierPremiumQuota,
        categoryAddonPriceCents: parsed.data.categoryAddonPriceCents,
        reminderDaysJson: parsed.data.reminderDays,
        partnershipLockEnabled: parsed.data.partnershipLockEnabled,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "platform.settings_updated",
      entityType: "platform_settings",
      entityId: "default",
      metadata: parsed.data,
    });

    revalidatePath("/app/plataforma");
    return { ok: true, message: "Parâmetros salvos." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function upsertPlanOverrideAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.master_admin],
      href: "/app/plataforma",
    });

    const organizationId = String(formData.get("organizationId") ?? "");
    const monthlyQuotaRaw = String(formData.get("monthlyQuota") ?? "").trim();
    const notes = String(formData.get("notes") || "") || null;
    const categoriesIncludedRaw = String(formData.get("categoriesIncluded") ?? "").trim();
    const segmentsIncludedRaw = String(formData.get("segmentsIncluded") ?? "").trim();
    const allowExtraCategoriesFree =
      formData.get("allowExtraCategoriesFree") === "on" ||
      formData.get("allowExtraCategoriesFree") === "true";

    if (!organizationId) return { ok: false, message: "Selecione a organização." };

    const monthlyQuota =
      monthlyQuotaRaw === "" || monthlyQuotaRaw.toLowerCase() === "null"
        ? null
        : Number(monthlyQuotaRaw);
    if (monthlyQuota !== null && !Number.isFinite(monthlyQuota)) {
      return { ok: false, message: "Franquia inválida." };
    }

    const features: Record<string, unknown> = {};
    if (categoriesIncludedRaw) {
      const n = Number(categoriesIncludedRaw);
      if (Number.isFinite(n)) features.categoriesIncluded = n;
    }
    if (segmentsIncludedRaw) {
      const n = Number(segmentsIncludedRaw);
      if (Number.isFinite(n)) features.segmentsIncluded = n;
    }
    if (allowExtraCategoriesFree) {
      features.allowExtraCategoriesFree = true;
    }

    await firestoreDb.planOverride.upsert({
      where: { organizationId },
      create: {
        organizationId,
        monthlyQuota,
        notes,
        featuresJson: Object.keys(features).length ? JSON.stringify(features) : null,
      },
      update: {
        monthlyQuota,
        notes,
        featuresJson: Object.keys(features).length ? JSON.stringify(features) : null,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "platform.override_upserted",
      entityType: "organization",
      entityId: organizationId,
      metadata: { monthlyQuota, notes, features },
    });

    revalidatePath("/app/plataforma");
    return { ok: true, message: "Override salvo." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function deletePlanOverrideAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAuthorizedSession({
      types: [OrganizationType.master_admin],
      href: "/app/plataforma",
    });
    const organizationId = String(formData.get("organizationId") ?? "");
    if (!organizationId) return { ok: false, message: "Org inválida." };
    await firestoreDb.planOverride.delete({ where: { organizationId } }).catch(() => null);
    revalidatePath("/app/plataforma");
    return { ok: true, message: "Override removido." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function createCustomBillingCheckoutAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.master_admin],
      href: "/app/plataforma",
    });

    const organizationId = String(formData.get("organizationId") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    const amountReais = Number(String(formData.get("amountReais") ?? "").replace(",", "."));
    const planSlugRaw = String(formData.get("planSlug") ?? "").trim();
    const planSlug = planSlugRaw || "fornecedor-vip";

    if (!organizationId) return { ok: false, message: "Selecione a organização." };
    if (!description) return { ok: false, message: "Informe a descrição do adicional." };
    if (!Number.isFinite(amountReais) || amountReais <= 0) {
      return { ok: false, message: "Informe um valor válido em reais." };
    }

    const { createCustomBillingCheckout } = await import("@/features/billing/subscriptions");
    const result = await createCustomBillingCheckout({
      organizationId,
      userId: session.userId,
      amountCents: Math.round(amountReais * 100),
      description,
      planSlug,
    });

    revalidatePath("/app/plataforma");
    return {
      ok: true,
      message: `Checkout criado: ${result.checkoutUrl}`,
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
