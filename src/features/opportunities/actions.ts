"use server";

import { revalidatePath } from "next/cache";
import { OrganizationType, SupplierPipelineStage } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { storeProposalConditionAttachment } from "@/lib/storage";
import {
  acceptInviteSchema,
  declineInviteSchema,
  submitProposalSchema,
} from "@/features/opportunities/schemas";
import {
  assertSupplierCanAccessCategory,
  consumeSupplierFranchiseInTx,
  getSupplierFranchiseBalance,
} from "@/features/supplier/franchise";
import { markOverdueCompliance } from "@/features/compliance/expire";
import {
  isSupplierPipelineStage,
  type SupplierPipelineStageValue,
} from "@/features/opportunities/pipeline";
import { emitDomainEvent } from "@/lib/domain-events";

export type ActionResult = { ok: boolean; message?: string; proposalId?: string };

async function requireSupplier() {
  return requireAuthorizedSession({
    types: [OrganizationType.fornecedor],
    href: "/app/oportunidades",
  });
}

export async function moveSupplierOpportunityAction(input: {
  inviteId: string;
  stage: SupplierPipelineStageValue;
}): Promise<ActionResult> {
  try {
    const session = await requireSupplier();
    const inviteId = input.inviteId.trim();
    if (!inviteId || !isSupplierPipelineStage(input.stage)) {
      return { ok: false, message: "Movimentação inválida." };
    }

    const invite = await firestoreDb.quotationInvite.findFirst({
      where: { id: inviteId, supplierOrgId: session.organizationId },
      select: { id: true, supplierPipelineStage: true },
    });
    if (!invite) return { ok: false, message: "Oportunidade não encontrada." };

    const stage = input.stage as SupplierPipelineStage;
    await firestoreDb.quotationInvite.update({
      where: { id: invite.id },
      data: { supplierPipelineStage: stage },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "supplier.pipeline_moved",
      entityType: "quotation_invite",
      entityId: invite.id,
      metadata: {
        previousStage: invite.supplierPipelineStage,
        stage,
      },
    });

    revalidatePath("/app/oportunidades");
    return { ok: true, message: "Etapa atualizada." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function declineInviteAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSupplier();
    const parsed = declineInviteSchema.safeParse({
      inviteId: formData.get("inviteId"),
      reason: formData.get("reason") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const invite = await firestoreDb.quotationInvite.findFirst({
      where: {
        id: parsed.data.inviteId,
        supplierOrgId: session.organizationId,
        status: "pendente",
      },
      include: { quotation: true },
    });
    if (!invite) return { ok: false, message: "Oportunidade não encontrada." };

    await firestoreDb.quotationInvite.update({
      where: { id: invite.id },
      data: {
        status: "declinado",
        supplierPipelineStage: SupplierPipelineStage.perdida,
        declineReason: parsed.data.reason || null,
        declinedAt: new Date(),
      },
    });

    await emitDomainEvent({
      type: "invite.declined",
      entityType: "quotation_invite",
      entityId: invite.id,
      organizationId: session.organizationId,
      payload: {
        reason: parsed.data.reason ?? null,
        quotationId: invite.quotationId,
        solicitanteOrgId: invite.quotation.organizationId,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "invite.declined",
      entityType: "quotation_invite",
      entityId: invite.id,
    });

    // Refill: declínio libera slot até a meta máxima de propostas/convites.
    const { runDistributionEngine } = await import("@/features/distribution/engine");
    await runDistributionEngine(invite.quotationId);

    revalidatePath("/app/oportunidades");
    revalidatePath(`/app/cotacoes/${invite.quotationId}`);
    revalidatePath("/app");
    return { ok: true, message: "Oportunidade declinada." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function acceptInviteAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSupplier();
    const parsed = acceptInviteSchema.safeParse({
      inviteId: formData.get("inviteId"),
    });
    if (!parsed.success) return { ok: false, message: "Dados inválidos" };

    const invite = await firestoreDb.quotationInvite.findFirst({
      where: {
        id: parsed.data.inviteId,
        supplierOrgId: session.organizationId,
        status: "pendente",
      },
      include: { quotation: true },
    });
    if (!invite) return { ok: false, message: "Oportunidade não encontrada." };

    try {
      await assertSupplierCanAccessCategory(
        session.organizationId,
        invite.quotation.categoryId,
        invite.quotation.serviceItemId,
      );
    } catch {
      return {
        ok: false,
        message: "Categoria/segmento fora do seu pacote. Ajuste em Meu Plano ou faça upgrade.",
      };
    }

    await markOverdueCompliance(session.organizationId);
    const overdue = await firestoreDb.complianceDocument.count({
      where: { organizationId: session.organizationId, status: "em_atraso" },
    });
    if (overdue > 0) {
      return {
        ok: false,
        message: "Há documentos em atraso. Regularize o compliance antes de aceitar.",
      };
    }

    const balance = await getSupplierFranchiseBalance(session.organizationId);
    if (!balance.canSubmitProposal) {
      return {
        ok: false,
        message: "Limite mensal do plano Free esgotado (1 cotação/mês). Faça upgrade.",
      };
    }

    await firestoreDb.quotationInvite.update({
      where: { id: invite.id },
      data: {
        status: "aceito",
        supplierPipelineStage: SupplierPipelineStage.em_andamento,
        acceptedAt: new Date(),
      },
    });

    revalidatePath("/app/oportunidades");
    return { ok: true, message: "Oportunidade aceita. Envie a proposta." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function submitProposalAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSupplier();
    const inviteId = String(formData.get("inviteId") ?? "");

    const conditionCount = Number(formData.get("conditionCount") ?? 0);
    const conditions: Array<{
      amountCents: number;
      paymentTerms: string;
      formIndex: number;
    }> = [];
    for (let i = 0; i < conditionCount; i += 1) {
      const amountRaw = String(formData.get(`amount_${i}`) ?? "").replace(",", ".").trim();
      const paymentTerms = String(formData.get(`paymentTerms_${i}`) ?? "").trim();
      // Ignora blocos extras deixados em branco (ex.: 2ª condição não preenchida).
      if (!amountRaw && !paymentTerms) continue;
      const amountNumber = Number(amountRaw);
      const amountCents = Math.round(amountNumber * 100);
      conditions.push({
        amountCents,
        paymentTerms,
        formIndex: i,
      });
    }

    const parsed = submitProposalSchema.safeParse({
      inviteId,
      conditions: conditions.map(({ amountCents, paymentTerms }) => ({
        amountCents,
        paymentTerms,
      })),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const invite = await firestoreDb.quotationInvite.findFirst({
      where: {
        id: inviteId,
        supplierOrgId: session.organizationId,
        status: { in: ["pendente", "aceito"] },
      },
      include: { quotation: true, proposal: true },
    });
    if (!invite) return { ok: false, message: "Oportunidade não encontrada." };
    if (invite.proposal) return { ok: false, message: "Já existe proposta para este convite." };

    if (
      invite.quotation.invitesPaused ||
      invite.quotation.proposalsCount >= invite.quotation.maxProposals
    ) {
      return {
        ok: false,
        message: "Esta cotação atingiu o máximo de propostas e não recebe mais envios.",
      };
    }

    if (!["aberta", "em_negociacao"].includes(invite.quotation.status)) {
      return { ok: false, message: "Cotação não está aberta para propostas." };
    }

    try {
      await assertSupplierCanAccessCategory(
        session.organizationId,
        invite.quotation.categoryId,
        invite.quotation.serviceItemId,
      );
    } catch {
      return {
        ok: false,
        message: "Categoria/segmento fora do seu pacote. Ajuste em Meu Plano ou faça upgrade.",
      };
    }

    await markOverdueCompliance(session.organizationId);
    const overdue = await firestoreDb.complianceDocument.count({
      where: { organizationId: session.organizationId, status: "em_atraso" },
    });
    if (overdue > 0) {
      return {
        ok: false,
        message: "Há documentos em atraso. Regularize o compliance antes de enviar proposta.",
      };
    }

    const proposal = await firestoreDb.$transaction(async (tx) => {
      const locked = await tx.quotation.findUnique({ where: { id: invite.quotationId } });
      if (
        !locked ||
        locked.invitesPaused ||
        locked.proposalsCount >= locked.maxProposals
      ) {
        throw new Error("QUOTATION_MAX_REACHED");
      }

      await consumeSupplierFranchiseInTx(tx, session.organizationId);

      if (invite.status === "pendente") {
        await tx.quotationInvite.update({
          where: { id: invite.id },
          data: {
            status: "aceito",
            supplierPipelineStage: SupplierPipelineStage.proposta_enviada,
            acceptedAt: new Date(),
          },
        });
      } else {
        await tx.quotationInvite.update({
          where: { id: invite.id },
          data: { supplierPipelineStage: SupplierPipelineStage.proposta_enviada },
        });
      }

      const created = await tx.proposal.create({
        data: {
          inviteId: invite.id,
          organizationId: session.organizationId,
          quotationId: invite.quotationId,
          status: "enviada",
          createdByUserId: session.userId,
        },
      });

      for (const [index, condition] of parsed.data.conditions.entries()) {
        const createdCondition = await tx.proposalCondition.create({
          data: {
            proposalId: created.id,
            amountCents: condition.amountCents,
            paymentTerms: condition.paymentTerms,
            sortOrder: index,
          },
        });

        const formIndex = conditions[index]?.formIndex ?? index;
        const file = formData.get(`attachment_${formIndex}`);
        if (file instanceof File && file.size > 0) {
          const stored = await storeProposalConditionAttachment({
            organizationId: session.organizationId,
            proposalId: created.id,
            conditionIndex: index,
            file,
          });
          await tx.proposalConditionAttachment.create({
            data: {
              conditionId: createdCondition.id,
              fileName: stored.fileName,
              storagePath: stored.storagePath,
              contentType: stored.contentType,
              sizeBytes: stored.sizeBytes,
            },
          });
        }
      }

      await tx.quotation.update({
        where: { id: invite.quotationId },
        data: { proposalsCount: { increment: 1 } },
      });

      return created;
    });

    await emitDomainEvent({
      type: "proposal.submitted",
      entityType: "proposal",
      entityId: proposal.id,
      organizationId: session.organizationId,
      payload: {
        quotationId: invite.quotationId,
        conditions: parsed.data.conditions.length,
      },
    });

    const {
      emitMinProposalsIfReached,
      pauseQuotationInvitesIfMaxReached,
    } = await import("@/features/distribution/engine");
    await emitMinProposalsIfReached(invite.quotationId);
    await pauseQuotationInvitesIfMaxReached(invite.quotationId);

    await writeAuditLog({
      userId: session.userId,
      action: "proposal.submitted",
      entityType: "proposal",
      entityId: proposal.id,
    });

    revalidatePath("/app/oportunidades");
    revalidatePath("/app/cotacoes");
    revalidatePath(`/app/cotacoes/${invite.quotationId}`);
    revalidatePath("/app");
    return { ok: true, message: "Proposta enviada.", proposalId: proposal.id };
  } catch (error) {
    if (error instanceof Error && error.message === "SUPPLIER_FRANCHISE_EXHAUSTED") {
      return {
        ok: false,
        message: "Limite mensal do plano Free esgotado (1 cotação/mês). Faça upgrade.",
      };
    }
    if (error instanceof Error && error.message === "QUOTATION_MAX_REACHED") {
      return {
        ok: false,
        message: "Esta cotação atingiu o máximo de propostas e não recebe mais envios.",
      };
    }
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export type EvaluatePriceResult = ActionResult & {
  evaluation?: {
    proposedCents: number;
    averageCents: number;
    percentDelta: number;
    position: "acima" | "abaixo" | "dentro";
    sampleSize: number;
    source: "quotation" | "service_history";
  };
};

export async function evaluateProposalPriceAction(
  formData: FormData,
): Promise<EvaluatePriceResult> {
  try {
    const session = await requireSupplier();
    const inviteId = String(formData.get("inviteId") ?? "");
    const amount = Number(formData.get("amount"));
    if (!inviteId || !Number.isFinite(amount) || amount <= 0) {
      return { ok: false, message: "Informe o valor da condição para avaliar." };
    }
    const proposedCents = Math.round(amount * 100);

    const invite = await firestoreDb.quotationInvite.findFirst({
      where: { id: inviteId, supplierOrgId: session.organizationId },
      include: { quotation: true },
    });
    if (!invite) return { ok: false, message: "Convite não encontrado." };

    const { evaluatePriceAgainstAverage } = await import("@/features/opportunities/analysis");

    const sameQuotation = await firestoreDb.proposalCondition.findMany({
      where: {
        proposal: {
          quotationId: invite.quotationId,
          status: { not: "recusada" },
        },
      },
      select: { amountCents: true },
    });
    let samples = sameQuotation.map((c) => c.amountCents);
    let source: "quotation" | "service_history" = "quotation";

    if (samples.length < 2) {
      const history = await firestoreDb.proposalCondition.findMany({
        where: {
          proposal: {
            quotation: { serviceItemId: invite.quotation.serviceItemId },
            status: { in: ["enviada", "em_negociacao", "aprovada"] },
          },
        },
        select: { amountCents: true },
        take: 50,
        orderBy: { createdAt: "desc" },
      });
      samples = history.map((c) => c.amountCents);
      source = "service_history";
    }

    const evaluated = evaluatePriceAgainstAverage(proposedCents, samples);
    if (!evaluated) {
      return {
        ok: true,
        message: "Ainda não há base suficiente para calcular a média deste serviço.",
      };
    }

    return {
      ok: true,
      message:
        evaluated.position === "dentro"
          ? `Dentro da média (±5%). Média ${evaluated.averageCents / 100}`
          : `${evaluated.percentDelta > 0 ? "Acima" : "Abaixo"} da média em ${Math.abs(evaluated.percentDelta)}%. Média R$ ${(evaluated.averageCents / 100).toFixed(2)}`,
      evaluation: { ...evaluated, source },
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
