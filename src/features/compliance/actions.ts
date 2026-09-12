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
import { emitDomainEvent } from "@/lib/domain-events";

export type ActionResult = { ok: boolean; message?: string };

const reputationSchema = z.object({
  googleProfileUrl: z
    .string()
    .trim()
    .url("Informe o link válido do Perfil Google.")
    .min(1, "Perfil Google é obrigatório."),
  reclameAquiUrl: z
    .string()
    .trim()
    .url("Informe o link válido do Reclame Aqui.")
    .min(1, "Reclame Aqui é obrigatório."),
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
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Links obrigatórios inválidos." };
    }

    await firestoreDb.organization.update({
      where: { id: session.organizationId },
      data: {
        googleProfileUrl: parsed.data.googleProfileUrl,
        reclameAquiUrl: parsed.data.reclameAquiUrl,
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
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Selecione um arquivo." };
    }

    // Validade real só começa na aprovação (180 dias). Placeholder até a análise.
    const validUntil = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

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

    await emitDomainEvent({
      type: "compliance.updated",
      entityType: "compliance_document",
      entityId: created.id,
      organizationId: session.organizationId,
      payload: { status: created.status, documentType: created.documentType },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "compliance.uploaded",
      entityType: "compliance_document",
      entityId: created.id,
    });

    revalidatePath("/app/compliance");
    revalidatePath("/app/plataforma/compliance");
    return {
      ok: true,
      message: "Documento enviado para análise. A validade de 6 meses inicia na aprovação.",
    };
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
      include: {
        organization: {
          include: { members: { include: { user: true } } },
        },
      },
    });
    if (!doc) return { ok: false, message: "Documento não encontrado." };

    const now = new Date();
    const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;
    const validUntil =
      parsed.data.decision === "aprovado"
        ? new Date(now.getTime() + sixMonthsMs)
        : doc.validUntil;

    const updated = await firestoreDb.complianceDocument.update({
      where: { id: doc.id },
      data: {
        status: parsed.data.decision,
        reviewNotes: parsed.data.reviewNotes || null,
        reviewedAt: now,
        reviewedByUserId: session.userId,
        ...(parsed.data.decision === "aprovado" ? { validUntil } : {}),
      },
    });

    await emitDomainEvent({
      type: "compliance.updated",
      entityType: "compliance_document",
      entityId: updated.id,
      organizationId: updated.organizationId,
      payload: {
        status: updated.status,
        reviewNotes: updated.reviewNotes,
        validUntil: validUntil.toISOString(),
        message: `Documento ${updated.documentType} marcado como ${updated.status}.`,
      },
    });

    const { notifyOrgMembers } = await import("@/features/notifications/service");
    const { sendTemplatedEmail } = await import("@/features/notifications/email-provider");

    if (parsed.data.decision === "aprovado") {
      const days = Math.round(sixMonthsMs / (24 * 60 * 60 * 1000));
      await notifyOrgMembers(updated.organizationId, {
        type: "compliance.approved",
        title: "Documento de compliance aprovado",
        body: `"${updated.documentType}" aprovado. Validade de ${days} dias até ${validUntil.toLocaleDateString("pt-BR")}.`,
        href: "/app/compliance",
        metadata: { documentId: updated.id, validUntil: validUntil.toISOString() },
      });
      for (const member of doc.organization.members) {
        await sendTemplatedEmail({
          toEmail: member.user.email,
          subject: `CotaCondo — ${updated.documentType} aprovado`,
          bodyText: [
            `Olá ${member.user.name},`,
            "",
            `Seu documento "${updated.documentType}" foi aprovado.`,
            `Validade: ${days} dias (até ${validUntil.toLocaleDateString("pt-BR")}).`,
            "Você receberá um lembrete 5 dias antes do vencimento.",
            "",
            "Acesse /app/compliance",
          ].join("\n"),
          template: "compliance_updated",
          metadata: { documentId: updated.id, status: "aprovado" },
        });
      }
    } else {
      await notifyOrgMembers(updated.organizationId, {
        type: "compliance.rejected",
        title: "Documento de compliance rejeitado",
        body: `"${updated.documentType}" foi rejeitado. Envie uma nova versão.`,
        href: "/app/compliance",
        metadata: { documentId: updated.id },
      });
      for (const member of doc.organization.members) {
        await sendTemplatedEmail({
          toEmail: member.user.email,
          subject: `CotaCondo — ${updated.documentType} rejeitado`,
          bodyText: [
            `Olá ${member.user.name},`,
            "",
            `Seu documento "${updated.documentType}" foi rejeitado.`,
            parsed.data.reviewNotes ? `Nota: ${parsed.data.reviewNotes}` : "",
            "Envie um novo arquivo em /app/compliance.",
          ]
            .filter(Boolean)
            .join("\n"),
          template: "compliance_updated",
          metadata: { documentId: updated.id, status: "negada" },
        });
      }
    }

    await writeAuditLog({
      userId: session.userId,
      action: "compliance.reviewed",
      entityType: "compliance_document",
      entityId: updated.id,
      metadata: { decision: parsed.data.decision, validUntil: validUntil.toISOString() },
    });

    revalidatePath("/app/compliance");
    revalidatePath("/app/plataforma/compliance");
    return {
      ok: true,
      message:
        parsed.data.decision === "aprovado"
          ? `Documento aprovado. Validade de 180 dias até ${validUntil.toLocaleDateString("pt-BR")}. Fornecedor notificado.`
          : "Documento negado. Fornecedor notificado.",
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
