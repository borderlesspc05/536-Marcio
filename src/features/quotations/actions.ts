"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { AppError, toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { storeQuotationAttachment } from "@/lib/storage";
import { quotationSchema } from "@/features/quotations/schemas";
import {
  createQuotationConsumingFranchise,
  currentYearMonth,
  getFranchiseBalance,
} from "@/features/quotations/franchise";

export type ActionResult = { ok: boolean; message?: string; quotationId?: string };

const ALLOWED_TYPES = [OrganizationType.sindico, OrganizationType.administradora];

async function requireSolicitante() {
  return requireAuthorizedSession({
    types: ALLOWED_TYPES,
    href: "/app/cotacoes",
  });
}

function generatePublicId(): string {
  const ym = currentYearMonth().replace("-", "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `COT-${ym}-${suffix}`;
}

export async function createQuotationAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSolicitante();
    const parsed = quotationSchema.safeParse({
      condominiumId: formData.get("condominiumId"),
      categoryId: formData.get("categoryId"),
      serviceItemId: formData.get("serviceItemId"),
      urgency: formData.get("urgency") || "media",
      description: formData.get("description"),
      minProposals: formData.get("minProposals") || 3,
      maxProposals: formData.get("maxProposals") || 10,
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const balance = await getFranchiseBalance(session.organizationId);
    if (!balance.canCreate) {
      return {
        ok: false,
        message: "Franquia mensal esgotada. Faça upgrade do plano para abrir novas cotações.",
      };
    }

    const [condominium, category, serviceItem] = await Promise.all([
      firestoreDb.condominium.findFirst({
        where: {
          id: parsed.data.condominiumId,
          organizationId: session.organizationId,
          archivedAt: null,
        },
      }),
      firestoreDb.serviceCategory.findFirst({
        where: { id: parsed.data.categoryId, isActive: true, deletedAt: null },
      }),
      firestoreDb.serviceItem.findFirst({
        where: {
          id: parsed.data.serviceItemId,
          categoryId: parsed.data.categoryId,
          isActive: true,
          deletedAt: null,
        },
      }),
    ]);

    if (!condominium) return { ok: false, message: "Condomínio inválido." };
    if (!category || !serviceItem) {
      return { ok: false, message: "Categoria/serviço inativos ou inválidos." };
    }

    let publicId = generatePublicId();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const exists = await firestoreDb.quotation.findUnique({ where: { publicId } });
      if (!exists) break;
      publicId = generatePublicId();
    }

    let quotation;
    try {
      quotation = await createQuotationConsumingFranchise({
        organizationId: session.organizationId,
        condominiumId: condominium.id,
        categoryId: category.id,
        serviceItemId: serviceItem.id,
        urgency: parsed.data.urgency,
        description: parsed.data.description,
        minProposals: parsed.data.minProposals,
        maxProposals: parsed.data.maxProposals,
        createdByUserId: session.userId,
        publicId,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "FRANCHISE_EXHAUSTED") {
        return {
          ok: false,
          message: "Franquia mensal esgotada. Faça upgrade do plano para abrir novas cotações.",
        };
      }
      throw error;
    }

    const files = formData
      .getAll("attachments")
      .filter((item): item is File => item instanceof File && item.size > 0);
    for (const file of files.slice(0, 5)) {
      const stored = await storeQuotationAttachment({
        organizationId: session.organizationId,
        quotationId: quotation.id,
        file,
      });
      await firestoreDb.quotationAttachment.create({
        data: {
          quotationId: quotation.id,
          fileName: stored.fileName,
          storagePath: stored.storagePath,
          contentType: stored.contentType,
          sizeBytes: stored.sizeBytes,
        },
      });
    }

    await writeAuditLog({
      userId: session.userId,
      action: "quotation.created",
      entityType: "quotation",
      entityId: quotation.id,
      metadata: { publicId: quotation.publicId },
    });

    const { runDistributionEngine } = await import("@/features/distribution/engine");
    const distribution = await runDistributionEngine(quotation.id);
    await writeAuditLog({
      userId: session.userId,
      action: "distribution.ran",
      entityType: "quotation",
      entityId: quotation.id,
      metadata: {
        invited: distribution.invited.length,
        skipped: distribution.skipped.length,
      },
    });

    revalidatePath("/app");
    revalidatePath("/app/cotacoes");
    revalidatePath("/app/oportunidades");
    return {
      ok: true,
      message: `Cotação aberta. ${distribution.invited.length} fornecedor(es) convidado(s).`,
      quotationId: quotation.id,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
