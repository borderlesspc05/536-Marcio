"use server";

import { revalidatePath } from "next/cache";
import { OrganizationType, SupplierPipelineStage } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import {
  approveConditionSchema,
  approveOthersSchema,
  negotiateSchema,
  negotiationMessageSchema,
  negotiationMessagesBulkSchema,
  updateProposalConditionsSchema,
} from "@/features/negotiation/schemas";
import { emitDomainEvent } from "@/lib/domain-events";

export type ActionResult = { ok: boolean; message?: string };

const SOLICITANTE = [OrganizationType.sindico, OrganizationType.administradora];

async function requireSolicitante() {
  return requireAuthorizedSession({ types: SOLICITANTE, href: "/app/cotacoes" });
}

export async function startNegotiationAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSolicitante();
    const proposalIds = formData.getAll("proposalIds").map(String).filter(Boolean);
    const parsed = negotiateSchema.safeParse({
      proposalIds,
      message: formData.get("message"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const proposals = await firestoreDb.proposal.findMany({
      where: {
        id: { in: parsed.data.proposalIds },
        quotation: { organizationId: session.organizationId },
        status: { in: ["enviada", "em_negociacao"] },
      },
    });
    if (proposals.length === 0) {
      return { ok: false, message: "Nenhuma proposta válida selecionada." };
    }

    const quotationId = proposals[0]!.quotationId;

    await firestoreDb.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id: quotationId },
        data: { status: "em_negociacao" },
      });
      await tx.proposal.updateMany({
        where: { id: { in: proposals.map((item) => item.id) } },
        data: { status: "em_negociacao" },
      });
      await tx.quotationInvite.updateMany({
        where: { id: { in: proposals.map((item) => item.inviteId) } },
        data: { supplierPipelineStage: SupplierPipelineStage.negociacao },
      });
      for (const proposal of proposals) {
        await tx.negotiationMessage.create({
          data: {
            proposalId: proposal.id,
            organizationId: session.organizationId,
            authorUserId: session.userId,
            body: parsed.data.message,
          },
        });
      }
    });

    const supplierOrgIds = [...new Set(proposals.map((item) => item.organizationId))];
    await emitDomainEvent({
      type: "negotiation.started",
      entityType: "quotation",
      entityId: quotationId,
      organizationId: session.organizationId,
      payload: {
        proposalIds: proposals.map((item) => item.id),
        quotationId,
        solicitanteOrgId: session.organizationId,
        supplierOrgIds,
        supplierOrgId: supplierOrgIds[0],
        preview: parsed.data.message.slice(0, 120),
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "negotiation.started",
      entityType: "quotation",
      entityId: quotationId,
    });

    revalidatePath(`/app/cotacoes/${quotationId}`);
    revalidatePath("/app/oportunidades");
    return {
      ok: true,
      message:
        supplierOrgIds.length > 1
          ? `Mensagem enviada e notificação disparada para ${supplierOrgIds.length} fornecedores.`
          : "Mensagem enviada e fornecedor notificado.",
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function sendNegotiationMessageAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession();
    const parsed = negotiationMessageSchema.safeParse({
      proposalId: formData.get("proposalId"),
      body: formData.get("body"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const proposal = await firestoreDb.proposal.findUnique({
      where: { id: parsed.data.proposalId },
      include: { quotation: true },
    });
    if (!proposal) return { ok: false, message: "Proposta não encontrada." };

    const isSolicitante = proposal.quotation.organizationId === session.organizationId;
    const isSupplier = proposal.organizationId === session.organizationId;
    const isMasterAdmin = session.organizationType === OrganizationType.master_admin;
    if (!isSolicitante && !isSupplier && !isMasterAdmin) {
      return { ok: false, message: "Sem permissão." };
    }
    if (isSupplier) {
      const { assertSupplierCanChat } = await import("@/features/supplier/franchise");
      try {
        await assertSupplierCanChat(session.organizationId);
      } catch {
        return {
          ok: false,
          message: "Chat com o solicitante disponível no plano pago. Faça upgrade para solicitar informações.",
        };
      }
    }
    if (proposal.status !== "em_negociacao" && proposal.quotation.status !== "em_negociacao") {
      return { ok: false, message: "Proposta não está em negociação." };
    }

    await firestoreDb.negotiationMessage.create({
      data: {
        proposalId: proposal.id,
        organizationId: session.organizationId,
        authorUserId: session.userId,
        body: parsed.data.body,
      },
    });

    await emitDomainEvent({
      type: "negotiation.message",
      entityType: "proposal",
      entityId: proposal.id,
      organizationId: session.organizationId,
      payload: {
        quotationId: proposal.quotationId,
        solicitanteOrgId: proposal.quotation.organizationId,
        supplierOrgId: proposal.organizationId,
        preview: parsed.data.body.slice(0, 120),
      },
    });

    revalidatePath(`/app/cotacoes/${proposal.quotationId}`);
    revalidatePath("/app/oportunidades");
    return { ok: true, message: "Mensagem enviada." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function sendNegotiationMessagesBulkAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSolicitante();
    const proposalIds = formData.getAll("proposalIds").map(String).filter(Boolean);
    const parsed = negotiationMessagesBulkSchema.safeParse({
      proposalIds,
      body: formData.get("body") ?? formData.get("message"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const proposals = await firestoreDb.proposal.findMany({
      where: {
        id: { in: parsed.data.proposalIds },
        quotation: { organizationId: session.organizationId },
      },
      include: { quotation: true },
    });
    if (proposals.length === 0) {
      return { ok: false, message: "Nenhuma proposta válida selecionada." };
    }

    const inNegotiation = proposals.filter(
      (item) => item.status === "em_negociacao" || item.quotation.status === "em_negociacao",
    );
    if (inNegotiation.length === 0) {
      return { ok: false, message: "Propostas não estão em negociação." };
    }

    const quotationId = inNegotiation[0]!.quotationId;
    const supplierOrgIds = [...new Set(inNegotiation.map((item) => item.organizationId))];

    for (const proposal of inNegotiation) {
      await firestoreDb.negotiationMessage.create({
        data: {
          proposalId: proposal.id,
          organizationId: session.organizationId,
          authorUserId: session.userId,
          body: parsed.data.body,
        },
      });
    }

    await emitDomainEvent({
      type: "negotiation.message",
      entityType: "quotation",
      entityId: quotationId,
      organizationId: session.organizationId,
      payload: {
        quotationId,
        proposalIds: inNegotiation.map((item) => item.id),
        solicitanteOrgId: session.organizationId,
        supplierOrgIds,
        supplierOrgId: supplierOrgIds[0],
        preview: parsed.data.body.slice(0, 120),
      },
    });

    revalidatePath(`/app/cotacoes/${quotationId}`);
    revalidatePath("/app/oportunidades");
    return {
      ok: true,
      message:
        supplierOrgIds.length > 1
          ? `Mensagem enviada para ${supplierOrgIds.length} fornecedores.`
          : "Mensagem enviada.",
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function approveConditionAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSolicitante();
    const parsed = approveConditionSchema.safeParse({
      proposalId: formData.get("proposalId"),
      conditionId: formData.get("conditionId"),
    });
    if (!parsed.success) {
      return { ok: false, message: "Selecione uma condição válida." };
    }

    const proposal = await firestoreDb.proposal.findFirst({
      where: {
        id: parsed.data.proposalId,
        quotation: { organizationId: session.organizationId },
      },
      include: {
        conditions: true,
        quotation: true,
      },
    });
    if (!proposal) return { ok: false, message: "Proposta não encontrada." };
    if (["aprovada", "finalizada_outros", "cancelada", "encerrada"].includes(proposal.quotation.status)) {
      return { ok: false, message: "Cotação já finalizada." };
    }

    const condition = proposal.conditions.find((item) => item.id === parsed.data.conditionId);
    if (!condition) return { ok: false, message: "Condição inválida." };

    await firestoreDb.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposal.id },
        data: { status: "aprovada" },
      });
      await tx.proposal.updateMany({
        where: {
          quotationId: proposal.quotationId,
          id: { not: proposal.id },
          status: { not: "recusada" },
        },
        data: { status: "recusada" },
      });
      await tx.quotationInvite.update({
        where: { id: proposal.inviteId },
        data: { supplierPipelineStage: SupplierPipelineStage.ganha },
      });
      await tx.quotationInvite.updateMany({
        where: {
          quotationId: proposal.quotationId,
          id: { not: proposal.inviteId },
        },
        data: { supplierPipelineStage: SupplierPipelineStage.perdida },
      });
      await tx.quotation.update({
        where: { id: proposal.quotationId },
        data: {
          status: "aprovada",
          invitesPaused: true,
          approvedProposalId: proposal.id,
          approvedConditionId: condition.id,
        },
      });
    });

    await emitDomainEvent({
      type: "quotation.approved",
      entityType: "quotation",
      entityId: proposal.quotationId,
      organizationId: session.organizationId,
      payload: {
        proposalId: proposal.id,
        conditionId: condition.id,
        amountCents: condition.amountCents,
        supplierOrgId: proposal.organizationId,
        quotationId: proposal.quotationId,
        commissionHook: "recordCommissionFromApproval",
        remindersClosed: true,
      },
    });

    try {
      const { recordCommissionFromApproval } = await import("@/features/commissions/actions");
      await recordCommissionFromApproval({
        administradoraOrgId: session.organizationId,
        supplierOrgId: proposal.organizationId,
        quotationId: proposal.quotationId,
        proposalId: proposal.id,
        conditionId: condition.id,
        volumeCents: condition.amountCents,
        categoryId: proposal.quotation.categoryId,
      });
    } catch {
      // não bloqueia aprovação se ledger falhar
    }

    await writeAuditLog({
      userId: session.userId,
      action: "quotation.approved",
      entityType: "quotation",
      entityId: proposal.quotationId,
      metadata: {
        proposalId: proposal.id,
        conditionId: condition.id,
      },
    });

    revalidatePath(`/app/cotacoes/${proposal.quotationId}`);
    revalidatePath("/app/oportunidades");
    revalidatePath("/app");
    return { ok: true, message: "Proposta aprovada. Demais propostas recusadas." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function approveOthersAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSolicitante();
    const parsed = approveOthersSchema.safeParse({
      quotationId: formData.get("quotationId"),
      companyName: formData.get("companyName"),
      finalAmount: formData.get("finalAmount"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const quotation = await firestoreDb.quotation.findFirst({
      where: { id: parsed.data.quotationId, organizationId: session.organizationId },
    });
    if (!quotation) return { ok: false, message: "Cotação não encontrada." };
    if (["aprovada", "finalizada_outros", "cancelada", "encerrada"].includes(quotation.status)) {
      return { ok: false, message: "Cotação já finalizada." };
    }

    const amountCents = Math.round(parsed.data.finalAmount * 100);

    await firestoreDb.$transaction(async (tx) => {
      await tx.proposal.updateMany({
        where: {
          quotationId: quotation.id,
          status: { not: "recusada" },
        },
        data: { status: "recusada" },
      });
      await tx.quotationInvite.updateMany({
        where: { quotationId: quotation.id },
        data: { supplierPipelineStage: SupplierPipelineStage.perdida },
      });
      await tx.quotation.update({
        where: { id: quotation.id },
        data: {
          status: "finalizada_outros",
          invitesPaused: true,
          otherCompanyName: parsed.data.companyName,
          otherFinalAmountCents: amountCents,
        },
      });
    });

    await emitDomainEvent({
      type: "quotation.finalized_others",
      entityType: "quotation",
      entityId: quotation.id,
      organizationId: session.organizationId,
      payload: {
        companyName: parsed.data.companyName,
        amountCents,
        providerName: parsed.data.companyName,
        quotationId: quotation.id,
        remindersClosed: true,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "quotation.finalized_others",
      entityType: "quotation",
      entityId: quotation.id,
      metadata: {
        companyName: parsed.data.companyName,
        amountCents,
      },
    });

    revalidatePath(`/app/cotacoes/${quotation.id}`);
    revalidatePath("/app/oportunidades");
    revalidatePath("/app");
    return { ok: true, message: "Cotação finalizada fora da plataforma (Outros)." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function updateProposalDuringNegotiationAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.fornecedor],
      href: "/app/oportunidades",
    });

    const conditionCount = Number(formData.get("conditionCount") ?? 0);
    const conditions: Array<{ amountCents: number; paymentTerms: string }> = [];
    for (let i = 0; i < conditionCount; i += 1) {
      const amountRaw = String(formData.get(`amount_${i}`) ?? "").replace(",", ".");
      conditions.push({
        amountCents: Math.round(Number(amountRaw) * 100),
        paymentTerms: String(formData.get(`paymentTerms_${i}`) ?? ""),
      });
    }

    const parsed = updateProposalConditionsSchema.safeParse({
      proposalId: formData.get("proposalId"),
      conditions,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const proposal = await firestoreDb.proposal.findFirst({
      where: {
        id: parsed.data.proposalId,
        organizationId: session.organizationId,
        status: "em_negociacao",
      },
    });
    if (!proposal) return { ok: false, message: "Proposta em negociação não encontrada." };

    await firestoreDb.$transaction(async (tx) => {
      await tx.proposalConditionAttachment.deleteMany({
        where: { condition: { proposalId: proposal.id } },
      });
      await tx.proposalCondition.deleteMany({ where: { proposalId: proposal.id } });
      for (const [index, condition] of parsed.data.conditions.entries()) {
        await tx.proposalCondition.create({
          data: {
            proposalId: proposal.id,
            amountCents: condition.amountCents,
            paymentTerms: condition.paymentTerms,
            sortOrder: index,
          },
        });
      }
    });

    await emitDomainEvent({
      type: "negotiation.counter_offer",
      entityType: "proposal",
      entityId: proposal.id,
      organizationId: session.organizationId,
    });

    revalidatePath(`/app/cotacoes/${proposal.quotationId}`);
    revalidatePath("/app/oportunidades");
    return { ok: true, message: "Condições atualizadas." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function reinforceInviteAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSolicitante();
    const inviteId = String(formData.get("inviteId") ?? "");
    if (!inviteId) return { ok: false, message: "Convite inválido." };

    const invite = await firestoreDb.quotationInvite.findFirst({
      where: {
        id: inviteId,
        quotation: { organizationId: session.organizationId },
      },
      include: {
        quotation: true,
      },
    });
    if (!invite) return { ok: false, message: "Convite não encontrado." };
    if (invite.status === "declinado" || invite.status === "expirado") {
      return { ok: false, message: "Convite encerrado." };
    }

    await emitDomainEvent({
      type: "invite.reinforced",
      entityType: "quotation_invite",
      entityId: invite.id,
      organizationId: session.organizationId,
      payload: {
        supplierOrgId: invite.supplierOrgId,
        quotationId: invite.quotationId,
        publicId: invite.quotation.publicId,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "invite.reinforced",
      entityType: "quotation_invite",
      entityId: invite.id,
    });

    revalidatePath(`/app/cotacoes/${invite.quotationId}`);
    return { ok: true, message: "Pedido reforçado — fornecedor notificado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
