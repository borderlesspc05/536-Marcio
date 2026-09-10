"use server";

import { revalidatePath } from "next/cache";
import {
  OrganizationType,
  ServiceAiApiMode,
  ServicePipelineStatus,
  SupplierPipelineStage,
} from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { emitDomainEvent } from "@/lib/domain-events";
import { toPublicErrorMessage } from "@/lib/errors";
import { buildRifComparative, buildRifExecutiveDocument, RIF_MIN_PROPOSALS, generateAiRifInsights } from "./rif";
import { resolveRifBrand } from "./rif-brand";
import type { ActionResult } from "./action-result";

export type { ActionResult } from "./action-result";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

async function requireMasterService() {
  return requireAuthorizedSession({
    types: [OrganizationType.master_service],
  });
}

export async function createServiceClientAction(formData: FormData) {
  const session = await requireMasterService();
  const displayName = String(formData.get("displayName") || "").trim();
  const clientOrgId = String(formData.get("clientOrgId") || "").trim();
  const primaryColor = String(formData.get("primaryColor") || "#9333EA").trim();
  const secondaryColor = String(formData.get("secondaryColor") || "#14B8A6").trim();
  const logoUrl = String(formData.get("logoUrl") || "").trim() || null;
  const paymentLinkUrl = String(formData.get("paymentLinkUrl") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const aiApiMode =
    String(formData.get("aiApiMode") || "platform") === "client"
      ? ServiceAiApiMode.client
      : ServiceAiApiMode.platform;

  if (!displayName || !clientOrgId) {
    throw new Error("Nome e organização cliente são obrigatórios.");
  }

  const clientOrg = await firestoreDb.organization.findFirst({
    where: {
      id: clientOrgId,
      type: { in: [OrganizationType.administradora, OrganizationType.sindico] },
    },
  });
  if (!clientOrg) throw new Error("Organização cliente inválida.");

  const existing = await firestoreDb.serviceClient.findUnique({
    where: { clientOrgId },
  });
  if (existing) throw new Error("Este cliente já está no Cota Service.");

  let slug = slugify(displayName) || `cliente-${Date.now()}`;
  const slugTaken = await firestoreDb.serviceClient.findUnique({
    where: { solicitationLinkSlug: slug },
  });
  if (slugTaken) slug = `${slug}-${Date.now().toString(36)}`;

  const cotaServicePlan = await firestoreDb.plan.findUnique({
    where: { slug: "cota-service" },
  });

  const client = await firestoreDb.serviceClient.create({
    data: {
      managedByOrgId: session.organizationId,
      clientOrgId,
      displayName,
      primaryColor,
      secondaryColor,
      logoUrl,
      paymentLinkUrl,
      notes,
      aiApiMode,
      solicitationLinkSlug: slug,
      solicitationLinkActive: true,
    },
  });

  if (cotaServicePlan) {
    const active = await firestoreDb.subscription.findFirst({
      where: { organizationId: clientOrgId, status: "active" },
    });
    if (active) {
      await firestoreDb.subscription.update({
        where: { id: active.id },
        data: { planId: cotaServicePlan.id },
      });
    } else {
      await firestoreDb.subscription.create({
        data: {
          organizationId: clientOrgId,
          planId: cotaServicePlan.id,
          status: "active",
        },
      });
    }
  }

  await emitDomainEvent({
    type: "service_client.created",
    entityType: "ServiceClient",
    entityId: client.id,
    organizationId: session.organizationId,
    payload: { clientOrgId, displayName },
  });

  revalidatePath("/app/service/clientes");
  revalidatePath("/app");
}

export async function updateServiceClientAction(formData: FormData) {
  const session = await requireMasterService();
  const id = String(formData.get("id") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim();
  const primaryColor = String(formData.get("primaryColor") || "#9333EA").trim();
  const secondaryColor = String(formData.get("secondaryColor") || "#14B8A6").trim();
  const logoUrl = String(formData.get("logoUrl") || "").trim() || null;
  const paymentLinkUrl = String(formData.get("paymentLinkUrl") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const solicitationLinkActive = formData.get("solicitationLinkActive") === "on";
  const isActive = formData.get("isActive") === "on";
  const aiApiMode =
    String(formData.get("aiApiMode") || "platform") === "client"
      ? ServiceAiApiMode.client
      : ServiceAiApiMode.platform;
  const aiApiKey = String(formData.get("aiApiKey") || "").trim();

  const client = await firestoreDb.serviceClient.findFirst({
    where: { id, managedByOrgId: session.organizationId },
  });
  if (!client) throw new Error("Cliente não encontrado.");

  await firestoreDb.serviceClient.update({
    where: { id },
    data: {
      displayName: displayName || client.displayName,
      primaryColor,
      secondaryColor,
      logoUrl,
      paymentLinkUrl,
      notes,
      solicitationLinkActive,
      isActive,
      aiApiMode,
      ...(aiApiKey
        ? { aiApiKeyMasked: `${aiApiKey.slice(0, 4)}••••${aiApiKey.slice(-4)}` }
        : {}),
    },
  });

  revalidatePath("/app/service/clientes");
  revalidatePath(`/app/service/clientes/${id}`);
}

export async function addServiceClientManagerAction(formData: FormData) {
  const session = await requireMasterService();
  const serviceClientId = String(formData.get("serviceClientId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const roleLabel = String(formData.get("roleLabel") || "gerente").trim() || "gerente";

  const client = await firestoreDb.serviceClient.findFirst({
    where: { id: serviceClientId, managedByOrgId: session.organizationId },
  });
  if (!client) throw new Error("Cliente não encontrado.");
  if (!name || !email) throw new Error("Nome e e-mail obrigatórios.");

  const user = await firestoreDb.user.findUnique({ where: { email } });

  await firestoreDb.serviceClientManager.create({
    data: {
      serviceClientId,
      userId: user?.id ?? `pending:${email}`,
      name,
      email,
      roleLabel,
    },
  });

  revalidatePath(`/app/service/clientes/${serviceClientId}`);
}

export async function setServicePipelineStatusAction(formData: FormData) {
  const session = await requireMasterService();
  const quotationId = String(formData.get("quotationId") || "").trim();
  const status = String(formData.get("status") || "").trim() as ServicePipelineStatus;

  const quotation = await firestoreDb.quotation.findFirst({
    where: { id: quotationId, serviceManagedByOrgId: session.organizationId },
  });
  if (!quotation) throw new Error("Cotação não encontrada.");

  await firestoreDb.quotation.update({
    where: { id: quotationId },
    data: { servicePipelineStatus: status },
  });

  revalidatePath("/app/service/cotacoes");
  revalidatePath(`/app/service/cotacoes/${quotationId}`);
  revalidatePath("/app");
}

export async function masterAcceptProposalAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterService();
    const quotationId = String(formData.get("quotationId") || "").trim();
    const proposalId = String(formData.get("proposalId") || "").trim();

    const quotation = await firestoreDb.quotation.findFirst({
      where: { id: quotationId, serviceManagedByOrgId: session.organizationId },
      include: { serviceClient: true },
    });
    if (!quotation) return { ok: false, message: "Cotação não encontrada." };

    const proposal = await firestoreDb.proposal.findFirst({
      where: { id: proposalId, quotationId },
    });
    if (!proposal) return { ok: false, message: "Proposta inválida." };

    await firestoreDb.quotation.update({
      where: { id: quotationId },
      data: {
        approvedProposalId: proposalId,
        masterAcceptedAt: new Date(),
        servicePipelineStatus: ServicePipelineStatus.em_analise,
        rifVisibleToClient: true,
        status: "em_negociacao",
      },
    });

    if (quotation.requesterEmail) {
      await firestoreDb.emailOutbox.create({
        data: {
          toEmail: quotation.requesterEmail,
          subject: `Proposta pronta para revisão — ${quotation.publicId}`,
          bodyText: `Olá${quotation.requesterName ? `, ${quotation.requesterName}` : ""}. A equipe Cota Service liberou a proposta da cotação ${quotation.publicId} para sua análise. Acesse o painel de acompanhamento.`,
          template: "service_master_accept",
          metadataJson: JSON.stringify({ quotationId, proposalId }),
        },
      });
    }

    await emitDomainEvent({
      type: "service_quotation.master_accepted",
      entityType: "Quotation",
      entityId: quotationId,
      organizationId: session.organizationId,
      payload: { proposalId },
    });

    revalidatePath(`/app/service/cotacoes/${quotationId}`);
    revalidatePath("/app/service/cotacoes");
    revalidatePath("/app");
    return { ok: true, message: "Aceite Master registrado. Proposta indicada para o solicitante." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function solicitanteConfirmAcceptAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterService();
    const quotationId = String(formData.get("quotationId") || "").trim();

    const quotation = await firestoreDb.quotation.findFirst({
      where: { id: quotationId, serviceManagedByOrgId: session.organizationId },
    });
    if (!quotation?.approvedProposalId || !quotation.masterAcceptedAt) {
      return { ok: false, message: "Aceite do Master pendente." };
    }

    await firestoreDb.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: quotation.approvedProposalId! },
        data: { status: "aprovada" },
      });
      await tx.proposal.updateMany({
        where: {
          quotationId,
          id: { not: quotation.approvedProposalId! },
        },
        data: { status: "recusada" },
      });
      const approvedInvite = await tx.quotationInvite.findFirst({
        where: { proposal: { id: quotation.approvedProposalId! } },
        select: { id: true },
      });
      if (approvedInvite) {
        await tx.quotationInvite.update({
          where: { id: approvedInvite.id },
          data: { supplierPipelineStage: SupplierPipelineStage.ganha },
        });
        await tx.quotationInvite.updateMany({
          where: { quotationId, id: { not: approvedInvite.id } },
          data: { supplierPipelineStage: SupplierPipelineStage.perdida },
        });
      }
      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: "aprovada",
          servicePipelineStatus: ServicePipelineStatus.aprovada,
          solicitanteAcceptedAt: new Date(),
          contactReleasedAt: new Date(),
        },
      });
    });

    revalidatePath(`/app/service/cotacoes/${quotationId}`);
    revalidatePath("/app/service/cotacoes");
    return { ok: true, message: "Aceite do solicitante confirmado. Contato liberado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function markServiceExternalApprovalAction(formData: FormData) {
  const session = await requireMasterService();
  const quotationId = String(formData.get("quotationId") || "").trim();
  const companyName = String(formData.get("companyName") || "").trim();
  const amountReais = String(formData.get("amountReais") || "").trim();

  if (!companyName || !amountReais) {
    throw new Error("Informe a empresa e o valor fechado (obrigatório).");
  }

  const amountCents = Math.round(Number(amountReais.replace(",", ".")) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("Valor inválido.");
  }

  const quotation = await firestoreDb.quotation.findFirst({
    where: { id: quotationId, serviceManagedByOrgId: session.organizationId },
  });
  if (!quotation) throw new Error("Cotação não encontrada.");

  await firestoreDb.quotation.update({
    where: { id: quotationId },
    data: {
      status: "finalizada_outros",
      servicePipelineStatus: ServicePipelineStatus.aprovada,
      otherCompanyName: companyName,
      otherFinalAmountCents: amountCents,
      solicitanteAcceptedAt: new Date(),
    },
  });

  revalidatePath(`/app/service/cotacoes/${quotationId}`);
  revalidatePath("/app/service/cotacoes");
}

export async function markServiceRejectedAction(formData: FormData) {
  const session = await requireMasterService();
  const quotationId = String(formData.get("quotationId") || "").trim();

  await firestoreDb.quotation.updateMany({
    where: { id: quotationId, serviceManagedByOrgId: session.organizationId },
    data: {
      status: "recusada",
      servicePipelineStatus: ServicePipelineStatus.recusada,
    },
  });

  revalidatePath(`/app/service/cotacoes/${quotationId}`);
  revalidatePath("/app/service/cotacoes");
}

export async function generateRifAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterService();
    const quotationId = String(formData.get("quotationId") || "").trim();
    const publish = formData.get("publish") === "on";

    const quotation = await firestoreDb.quotation.findFirst({
      where: { id: quotationId, serviceManagedByOrgId: session.organizationId },
      include: {
        condominium: true,
        category: true,
        serviceItem: true,
        organization: true,
        proposals: {
          include: {
            organization: true,
            conditions: {
              orderBy: { sortOrder: "asc" },
              include: { attachments: true },
            },
          },
        },
        serviceClient: true,
      },
    });
    if (!quotation) return { ok: false, message: "Cotação não encontrada." };

    const proposalCount = quotation.proposals.length;
    if (proposalCount < RIF_MIN_PROPOSALS) {
      return {
        ok: false,
        message: `A Análise RIF só pode ser gerada com pelo menos ${RIF_MIN_PROPOSALS} propostas (agora: ${proposalCount}). Evita uso desnecessário de token.`,
      };
    }

    const comparative = buildRifComparative(
      quotation.proposals.map((proposal) => ({
        id: proposal.id,
        organization: proposal.organization,
        conditions: proposal.conditions,
        attachments: proposal.conditions.flatMap((condition) =>
          condition.attachments.map((item) => ({ fileName: item.fileName })),
        ),
      })),
    );

    const brand = await resolveRifBrand({
      organizationId: quotation.organizationId,
      serviceClient: quotation.serviceClient,
      organizationName: quotation.organization.name,
    });

    const document = buildRifExecutiveDocument({
      context: {
        publicId: quotation.publicId,
        condominiumName: quotation.condominium.name,
        categoryName: quotation.category.name,
        serviceName: quotation.serviceItem.name,
        description: quotation.description,
        requesterOrgName: quotation.organization.name,
      },
      averageCents: comparative.averageCents,
      rows: comparative.rows,
      brand,
    });

    const aiMode = quotation.serviceClient?.aiApiMode === "client" ? "client" : "platform";
    const aiInsights = await generateAiRifInsights({
      mode: aiMode,
      comparativeMarkdown: document.markdown,
    });

    await firestoreDb.rifAnalysis.create({
      data: {
        quotationId,
        generatedByUserId: session.userId,
        status: publish ? "published" : "draft",
        averageCents: comparative.averageCents,
        summaryMarkdown: document.markdown,
        comparativeJson: JSON.stringify({
          rows: comparative.rows,
          plainForWord: document.plainForWord,
          brand,
          context: {
            publicId: quotation.publicId,
            condominiumName: quotation.condominium.name,
            categoryName: quotation.category.name,
            serviceName: quotation.serviceItem.name,
            description: quotation.description,
            requesterOrgName: quotation.organization.name,
          },
        }),
        aiInsights,
      },
    });

    if (publish) {
      await firestoreDb.quotation.update({
        where: { id: quotationId },
        data: { rifVisibleToClient: true },
      });
    }

    revalidatePath(`/app/service/cotacoes/${quotationId}`);
    return {
      ok: true,
      message: publish
        ? "RIF gerado e publicado para o solicitante."
        : "RIF gerado como rascunho (não visível ao solicitante).",
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function dispatchServiceQuotationAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterService();
    const quotationId = String(formData.get("quotationId") || "").trim();

    const quotation = await firestoreDb.quotation.findFirst({
      where: { id: quotationId, serviceManagedByOrgId: session.organizationId },
    });
    if (!quotation) return { ok: false, message: "Cotação não encontrada." };

    await firestoreDb.quotation.update({
      where: { id: quotationId },
      data: {
        invitesPaused: false,
        servicePipelineStatus: ServicePipelineStatus.em_andamento,
        status: "aberta",
      },
    });

    const { runDistributionEngine } = await import("@/features/distribution/engine");
    const distribution = await runDistributionEngine(quotationId);

    revalidatePath(`/app/service/cotacoes/${quotationId}`);
    revalidatePath("/app/service/cotacoes");
    return {
      ok: true,
      message: `Disparado: ${distribution.invited.length} convite(s) / pipeline Em Andamento.`,
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
