"use server";

import { revalidatePath } from "next/cache";
import { OrganizationType } from "@/lib/domain/types";
import { z } from "zod";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { storeComplianceDocument } from "@/lib/storage";
import {
  complianceReviewSchema,
  complianceUploadSchema,
} from "@/features/compliance/schemas";
import { markOverdueCompliance } from "@/features/compliance/expire";

export type ActionResult = { ok: boolean; message?: string };

const reputationSchema = z.object({
  googleProfileUrl: z.string().url().optional().or(z.literal("")),
  reclameAquiUrl: z.string().url().optional().or(z.literal("")),
});

export async function updateReputationLinksAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.fornecedor],
      href: "/app/compliance",
    });

    const parsed = reputationSchema.safeParse({
      googleProfileUrl: String(formData.get("googleProfileUrl") ?? "").trim(),
      reclameAquiUrl: String(formData.get("reclameAquiUrl") ?? "").trim(),
    });
    if (!parsed.success) {
      return { ok: false, message: "Informe URLs válidas ou deixe em branco." };
    }

    await firestoreDb.organization.update({
      where: { id: session.organizationId },
      data: {
        googleProfileUrl: parsed.data.googleProfileUrl || null,
        reclameAquiUrl: parsed.data.reclameAquiUrl || null,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "compliance.reputation_updated",
      entityType: "organization",
      entityId: session.organizationId,
    });

    revalidatePath("/app/compliance");
    return { ok: true, message: "Links de reputação salvos." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function uploadComplianceDocumentAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.fornecedor],
      href: "/app/compliance",
    });

    const parsed = complianceUploadSchema.safeParse({
      documentType: formData.get("documentType"),
      validUntil: formData.get("validUntil"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Selecione um arquivo." };
    }

    const validUntil = new Date(parsed.data.validUntil);
    if (Number.isNaN(validUntil.getTime())) {
      return { ok: false, message: "Data de validade inválida." };
    }

    const replacesId = String(formData.get("replacesId") || "") || null;
    if (replacesId) {
      const previous = await firestoreDb.complianceDocument.findFirst({
        where: { id: replacesId, organizationId: session.organizationId },
      });
      if (!previous) return { ok: false, message: "Documento anterior não encontrado." };
    }

    const stored = await storeComplianceDocument({
      organizationId: session.organizationId,
      file,
    });

    const created = await firestoreDb.complianceDocument.create({
      data: {
        organizationId: session.organizationId,
        documentType: parsed.data.documentType,
        fileName: stored.fileName,
        storagePath: stored.storagePath,
        contentType: stored.contentType,
        sizeBytes: stored.sizeBytes,
        validUntil,
        status: "em_analise",
        replacesId,
      },
    });

    await firestoreDb.domainEvent.create({
      data: {
        type: "compliance.updated",
        entityType: "compliance_document",
        entityId: created.id,
        organizationId: session.organizationId,
        payload: JSON.stringify({ status: created.status, documentType: created.documentType }),
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "compliance.uploaded",
      entityType: "compliance_document",
      entityId: created.id,
    });

    revalidatePath("/app/compliance");
    revalidatePath("/app/plataforma/compliance");
    return { ok: true, message: "Documento enviado para análise." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function reviewComplianceDocumentAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.master_admin],
      href: "/app/plataforma/compliance",
    });

    const parsed = complianceReviewSchema.safeParse({
      documentId: formData.get("documentId"),
      decision: formData.get("decision"),
      reviewNotes: String(formData.get("reviewNotes") || "") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const doc = await firestoreDb.complianceDocument.findUnique({
      where: { id: parsed.data.documentId },
    });
    if (!doc) return { ok: false, message: "Documento não encontrado." };

    const updated = await firestoreDb.complianceDocument.update({
      where: { id: doc.id },
      data: {
        status: parsed.data.decision,
        reviewNotes: parsed.data.reviewNotes || null,
        reviewedAt: new Date(),
        reviewedByUserId: session.userId,
      },
    });

    await firestoreDb.domainEvent.create({
      data: {
        type: "compliance.updated",
        entityType: "compliance_document",
        entityId: updated.id,
        organizationId: updated.organizationId,
        payload: JSON.stringify({
          status: updated.status,
          reviewNotes: updated.reviewNotes,
          message: `Documento ${updated.documentType} marcado como ${updated.status}.`,
        }),
      },
    });

    const { notifyAfterDomainEvent } = await import("@/features/notifications/notify-after");
    await notifyAfterDomainEvent({
      type: "compliance.updated",
      entityType: "compliance_document",
      entityId: updated.id,
      organizationId: updated.organizationId,
      payload: {
        status: updated.status,
        reviewNotes: updated.reviewNotes,
        message: `Documento ${updated.documentType} marcado como ${updated.status}.`,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "compliance.reviewed",
      entityType: "compliance_document",
      entityId: updated.id,
      metadata: { decision: parsed.data.decision },
    });

    revalidatePath("/app/compliance");
    revalidatePath("/app/plataforma/compliance");
    return {
      ok: true,
      message: parsed.data.decision === "aprovado" ? "Documento aprovado." : "Documento negado.",
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function runComplianceExpireJobAction(): Promise<ActionResult> {
  try {
    await requireAuthorizedSession({
      types: [OrganizationType.master_admin],
      href: "/app/plataforma/compliance",
    });
    const count = await markOverdueCompliance();
    revalidatePath("/app/plataforma/compliance");
    return { ok: true, message: `${count} documento(s) marcados em atraso.` };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
