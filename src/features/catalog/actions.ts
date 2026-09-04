"use server";

import { revalidatePath } from "next/cache";
import { OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { categorySchema, serviceItemSchema } from "@/features/catalog/schemas";
import { itemSlug } from "@/features/catalog/seed-data";

export type ActionResult = { ok: boolean; message?: string };

async function requireMasterAdmin() {
  return requireAuthorizedSession({
    types: [OrganizationType.master_admin],
    href: "/app/plataforma",
  });
}

export async function createCategoryAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterAdmin();
    const parsed = categorySchema.safeParse({
      name: formData.get("name"),
      colorToken: formData.get("colorToken"),
      sortOrder: formData.get("sortOrder") || 0,
      isActive: formData.get("isActive") !== "off",
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const slug = itemSlug(parsed.data.name);
    const existing = await firestoreDb.serviceCategory.findUnique({ where: { slug } });
    if (existing && !existing.deletedAt) {
      return { ok: false, message: "Já existe uma categoria com este nome." };
    }

    if (existing?.deletedAt) {
      await firestoreDb.serviceCategory.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name,
          colorToken: parsed.data.colorToken,
          sortOrder: parsed.data.sortOrder,
          isActive: parsed.data.isActive,
          deletedAt: null,
        },
      });
    } else {
      await firestoreDb.serviceCategory.create({
        data: {
          name: parsed.data.name,
          slug,
          colorToken: parsed.data.colorToken,
          sortOrder: parsed.data.sortOrder,
          isActive: parsed.data.isActive,
        },
      });
    }

    await writeAuditLog({
      userId: session.userId,
      action: "catalog.category_upsert",
      entityType: "service_category",
      metadata: { slug },
    });
    revalidatePath("/app/plataforma/catalogo");
    return { ok: true, message: "Categoria salva." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function updateCategoryAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterAdmin();
    const id = String(formData.get("id") ?? "");
    const parsed = categorySchema.safeParse({
      name: formData.get("name"),
      colorToken: formData.get("colorToken"),
      sortOrder: formData.get("sortOrder") || 0,
      isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
    });
    if (!id || !parsed.success) {
      return { ok: false, message: "Dados inválidos" };
    }

    await firestoreDb.serviceCategory.update({
      where: { id },
      data: {
        name: parsed.data.name,
        colorToken: parsed.data.colorToken,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "catalog.category_update",
      entityType: "service_category",
      entityId: id,
    });
    revalidatePath("/app/plataforma/catalogo");
    revalidatePath(`/app/plataforma/catalogo/${id}`);
    return { ok: true, message: "Categoria atualizada." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function softDeleteCategoryAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, message: "Categoria inválida" };

    const linked = await firestoreDb.quotation.count({ where: { categoryId: id } });
    if (linked > 0) {
      await firestoreDb.serviceCategory.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
    } else {
      await firestoreDb.serviceCategory.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
    }

    await writeAuditLog({
      userId: session.userId,
      action: "catalog.category_soft_delete",
      entityType: "service_category",
      entityId: id,
      metadata: { linkedQuotations: linked },
    });
    revalidatePath("/app/plataforma/catalogo");
    return { ok: true, message: "Categoria desativada (exclusão lógica)." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function createServiceItemAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterAdmin();
    const parsed = serviceItemSchema.safeParse({
      categoryId: formData.get("categoryId"),
      name: formData.get("name"),
      isMandatory: formData.get("isMandatory") === "on" || formData.get("isMandatory") === "true",
      periodicityHint: formData.get("periodicityHint") || undefined,
      sortOrder: formData.get("sortOrder") || 0,
      isActive: formData.get("isActive") !== "off",
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const slug = itemSlug(parsed.data.name);
    await firestoreDb.serviceItem.upsert({
      where: {
        categoryId_slug: {
          categoryId: parsed.data.categoryId,
          slug,
        },
      },
      update: {
        name: parsed.data.name,
        isMandatory: parsed.data.isMandatory,
        periodicityHint: parsed.data.periodicityHint ?? null,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
        deletedAt: null,
      },
      create: {
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
        slug,
        isMandatory: parsed.data.isMandatory,
        periodicityHint: parsed.data.periodicityHint ?? null,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "catalog.service_upsert",
      entityType: "service_item",
      metadata: { slug, categoryId: parsed.data.categoryId },
    });
    revalidatePath(`/app/plataforma/catalogo/${parsed.data.categoryId}`);
    return { ok: true, message: "Serviço salvo." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function updateServiceItemAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterAdmin();
    const id = String(formData.get("id") ?? "");
    const parsed = serviceItemSchema.safeParse({
      categoryId: formData.get("categoryId"),
      name: formData.get("name"),
      isMandatory: formData.get("isMandatory") === "on" || formData.get("isMandatory") === "true",
      periodicityHint: formData.get("periodicityHint") || undefined,
      sortOrder: formData.get("sortOrder") || 0,
      isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
    });
    if (!id || !parsed.success) {
      return { ok: false, message: "Dados inválidos" };
    }

    await firestoreDb.serviceItem.update({
      where: { id },
      data: {
        name: parsed.data.name,
        isMandatory: parsed.data.isMandatory,
        periodicityHint: parsed.data.periodicityHint ?? null,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "catalog.service_update",
      entityType: "service_item",
      entityId: id,
    });
    revalidatePath(`/app/plataforma/catalogo/${parsed.data.categoryId}`);
    return { ok: true, message: "Serviço atualizado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function softDeleteServiceItemAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterAdmin();
    const id = String(formData.get("id") ?? "");
    const categoryId = String(formData.get("categoryId") ?? "");
    if (!id) return { ok: false, message: "Serviço inválido" };

    const linked = await firestoreDb.quotation.count({ where: { serviceItemId: id } });
    await firestoreDb.serviceItem.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "catalog.service_soft_delete",
      entityType: "service_item",
      entityId: id,
      metadata: { linkedQuotations: linked },
    });
    revalidatePath(`/app/plataforma/catalogo/${categoryId}`);
    return { ok: true, message: "Serviço desativado (exclusão lógica)." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
