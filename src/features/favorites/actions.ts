"use server";

import { revalidatePath } from "next/cache";
import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { can, getPlanGate } from "@/features/billing/plan-gate";

export type ActionResult = { ok: boolean; message?: string };

async function requireAdmPremium() {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.administradora],
    roles: [MemberRole.master],
    href: "/app/favoritos",
  });

  const gate = await getPlanGate(session.organizationId);
  if (!can(gate, "favorites")) {
    return { session: null as null, blocked: true as const };
  }

  return { session, blocked: false as const };
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
