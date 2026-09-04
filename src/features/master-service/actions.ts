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
import { buildRifComparative, generateAiRifInsights } from "./rif";

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

export async function masterAcceptProposalAction(formData: FormData) {
  const session = await requireMasterService();
  const quotationId = String(formData.get("quotationId") || "").trim();
  const proposalId = String(formData.get("proposalId") || "").trim();

  const quotation = await firestoreDb.quotation.findFirst({
    where: { id: quotationId, serviceManagedByOrgId: session.organizationId },
    include: { serviceClient: true },
  });
  if (!quotation) throw new Error("Cotação não encontrada.");

  const proposal = await firestoreDb.proposal.findFirst({
    where: { id: proposalId, quotationId },
  });
  if (!proposal) throw new Error("Proposta inválida.");

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
}

export async function solicitanteConfirmAcceptAction(formData: FormData) {
  const session = await requireMasterService();
  const quotationId = String(formData.get("quotationId") || "").trim();

  const quotation = await firestoreDb.quotation.findFirst({
    where: { id: quotationId, serviceManagedByOrgId: session.organizationId },
  });
  if (!quotation?.approvedProposalId || !quotation.masterAcceptedAt) {
    throw new Error("Aceite do Master pendente.");
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

export async function generateRifAction(formData: FormData) {
  const session = await requireMasterService();
  const quotationId = String(formData.get("quotationId") || "").trim();
  const publish = formData.get("publish") === "on";

  const quotation = await firestoreDb.quotation.findFirst({
    where: { id: quotationId, serviceManagedByOrgId: session.organizationId },
    include: {
      proposals: {
        include: {
          organization: true,
          conditions: { orderBy: { sortOrder: "asc" } },
        },
      },
      serviceClient: true,
    },
  });
  if (!quotation) throw new Error("Cotação não encontrada.");

  const comparative = buildRifComparative(quotation.proposals);
  const aiMode = quotation.serviceClient?.aiApiMode === "client" ? "client" : "platform";
  const aiInsights = await generateAiRifInsights({
    mode: aiMode,
    comparativeMarkdown: comparative.markdown,
  });

  await firestoreDb.rifAnalysis.create({
    data: {
      quotationId,
      generatedByUserId: session.userId,
      status: publish ? "published" : "draft",
      averageCents: comparative.averageCents,
      summaryMarkdown: comparative.markdown,
      comparativeJson: JSON.stringify(comparative.rows),
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
}

export async function dispatchServiceQuotationAction(formData: FormData) {
  const session = await requireMasterService();
  const quotationId = String(formData.get("quotationId") || "").trim();

  const quotation = await firestoreDb.quotation.findFirst({
    where: { id: quotationId, serviceManagedByOrgId: session.organizationId },
  });
  if (!quotation) throw new Error("Cotação não encontrada.");

  await firestoreDb.quotation.update({
    where: { id: quotationId },
    data: {
      invitesPaused: false,
      servicePipelineStatus: ServicePipelineStatus.em_andamento,
      status: "aberta",
    },
  });

  revalidatePath(`/app/service/cotacoes/${quotationId}`);
  revalidatePath("/app/service/cotacoes");
}
