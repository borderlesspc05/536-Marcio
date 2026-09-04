"use server";

import { revalidatePath } from "next/cache";
import { OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { selectCategorySegmentsSchema } from "@/features/supplier/schemas";
import { getSupplierPlanInfo } from "@/features/supplier/franchise";

export type ActionResult = { ok: boolean; message?: string; upgradeRequired?: boolean };

export async function updateSupplierCategoriesAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.fornecedor],
      href: "/app/meu-plano",
    });

    const rawPairs = formData.getAll("pairs").map(String).filter(Boolean);
    const links = rawPairs.map((pair) => {
      const [categoryId, serviceItemId] = pair.split(":");
      return {
        categoryId: categoryId ?? "",
        serviceItemId: serviceItemId ?? "",
        contactName: String(formData.get(`contactName:${pair}`) || "") || undefined,
        contactEmail: String(formData.get(`contactEmail:${pair}`) || "") || undefined,
        contactPhone: String(formData.get(`contactPhone:${pair}`) || "") || undefined,
      };
    });

    const parsed = selectCategorySegmentsSchema.safeParse({ links });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const plan = await getSupplierPlanInfo(session.organizationId);
    const uniqueCategories = new Set(parsed.data.links.map((l) => l.categoryId));
    const uniqueSegments = new Set(parsed.data.links.map((l) => l.serviceItemId));

    if (
      uniqueCategories.size > plan.categoriesIncluded ||
      uniqueSegments.size > plan.segmentsIncluded
    ) {
      return {
        ok: false,
        upgradeRequired: true,
        message: plan.isFree
          ? "Plano Free contempla apenas 1 categoria e 1 segmento. Faça upgrade ou solicite liberação ao gestor."
          : `Seu plano permite até ${plan.categoriesIncluded} categoria(s) e ${plan.segmentsIncluded} segmento(s).`,
      };
    }

    for (const link of parsed.data.links) {
      const item = await firestoreDb.serviceItem.findFirst({
        where: {
          id: link.serviceItemId,
          categoryId: link.categoryId,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!item) {
        return { ok: false, message: "Segmento inválido para a categoria selecionada." };
      }
    }

    await firestoreDb.$transaction(async (tx) => {
      await tx.organizationCategory.deleteMany({
        where: { organizationId: session.organizationId },
      });
      await tx.organizationCategory.createMany({
        data: parsed.data.links.map((link) => ({
          organizationId: session.organizationId,
          categoryId: link.categoryId,
          serviceItemId: link.serviceItemId,
          contactName: link.contactName ?? null,
          contactEmail: link.contactEmail ?? null,
          contactPhone: link.contactPhone ?? null,
          isIncluded: true,
        })),
      });
    });

    await writeAuditLog({
      userId: session.userId,
      action: "supplier.categories.updated",
      entityType: "organization",
      entityId: session.organizationId,
      metadata: { links: parsed.data.links },
    });

    revalidatePath("/app/meu-plano");
    revalidatePath("/app");
    return { ok: true, message: "Categorias e segmentos atualizados." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
