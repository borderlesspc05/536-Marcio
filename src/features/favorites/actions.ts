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
      href: "/app/favoritos",
      feature: "favorites",
    });
    return { session, blocked: false as const };
  } catch (error) {
    unstable_rethrow(error);
    return { session: null as null, blocked: true as const };
  }
}

export async function toggleFavoriteSupplierAction(formData: FormData): Promise<ActionResult> {
  try {
    const gate = await requireAdmPremium();
    if (gate.blocked || !gate.session) {
      return {
        ok: false,
        message: "Favoritos disponíveis apenas no plano Administradora Premium.",
      };
    }

    const supplierOrgId = String(formData.get("supplierOrgId") ?? "");
    const categoryId = String(formData.get("categoryId") || "") || null;
    if (!supplierOrgId) return { ok: false, message: "Fornecedor inválido." };

    const supplier = await firestoreDb.organization.findFirst({
      where: { id: supplierOrgId, type: "fornecedor" },
    });
    if (!supplier) return { ok: false, message: "Fornecedor não encontrado." };

    const existing = await firestoreDb.favoriteSupplier.findUnique({
      where: {
        organizationId_supplierOrgId: {
          organizationId: gate.session.organizationId,
          supplierOrgId,
        },
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
      revalidatePath("/app/favoritos");
      return { ok: true, message: "Removido dos favoritos." };
    }

    await firestoreDb.favoriteSupplier.create({
      data: {
        organizationId: gate.session.organizationId,
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
    revalidatePath("/app/favoritos");
    return { ok: true, message: "Fornecedor favoritado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
