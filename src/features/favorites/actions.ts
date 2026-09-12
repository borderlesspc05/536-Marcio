"use server";

import { revalidatePath } from "next/cache";
import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { requireCapability } from "@/lib/auth/capability";
import { unstable_rethrow } from "next/navigation";

export type ActionResult = { ok: boolean; message?: string };

async function requireAdmPremium() {
  try {
    const { session } = await requireCapability({
      types: [OrganizationType.administradora],
      roles: [MemberRole.master],
      href: "/app/parcerias",
      feature: "favorites",
    });
    return { session, blocked: false as const };
  } catch (error) {
    unstable_rethrow(error);
    return { session: null as null, blocked: true as const };
  }
}

/** Preferir vincular via Parcerias; mantido para compatibilidade. */
export async function toggleFavoriteSupplierAction(formData: FormData): Promise<ActionResult> {
  try {
    const gate = await requireAdmPremium();
    if (gate.blocked || !gate.session) {
      return {
        ok: false,
        message: "Prioridade de parceiros disponível no plano Administradora Premium (Parcerias).",
      };
    }

    const supplierOrgId = String(formData.get("supplierOrgId") ?? "");
    const categoryId = String(formData.get("categoryId") || "") || null;
    if (!supplierOrgId) return { ok: false, message: "Fornecedor inválido." };

    const supplier = await firestoreDb.organization.findFirst({
      where: { id: supplierOrgId, type: "fornecedor" },
    });
    if (!supplier) return { ok: false, message: "Fornecedor não encontrado." };

    const existing = await firestoreDb.favoriteSupplier.findFirst({
      where: {
        ownerOrgId: gate.session.organizationId,
        supplierOrgId,
      },
    });

    if (existing) {
      await firestoreDb.favoriteSupplier.delete({ where: { id: existing.id } });
      await writeAuditLog({
        userId: gate.session.userId,
        action: "favorite.removed",
        entityType: "organization",
        entityId: supplierOrgId,
      });
      revalidatePath("/app/parcerias");
      revalidatePath("/app/favoritos");
      return { ok: true, message: "Prioridade removida." };
    }

    await firestoreDb.favoriteSupplier.create({
      data: {
        ownerOrgId: gate.session.organizationId,
        supplierOrgId,
        categoryId,
      },
    });
    await writeAuditLog({
      userId: gate.session.userId,
      action: "favorite.added",
      entityType: "organization",
      entityId: supplierOrgId,
    });
    revalidatePath("/app/parcerias");
    revalidatePath("/app/favoritos");
    return { ok: true, message: "Prioridade 1 ativada para o parceiro." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
