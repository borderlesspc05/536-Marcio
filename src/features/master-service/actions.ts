"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import {
  MemberRole,
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
import {
  normalizeWhitelabelSlug,
  WHITELABEL_RESERVED_SLUGS,
} from "./whitelabel-url";
import type { ActionResult } from "./action-result";

export type { ActionResult } from "./action-result";

function slugify(value: string) {
  return normalizeWhitelabelSlug(value);
}

async function requireMasterService() {
  return requireAuthorizedSession({
    types: [OrganizationType.master_service],
  });
}

async function assertUniqueSlug(slug: string, excludeId?: string) {
  if (!slug || WHITELABEL_RESERVED_SLUGS.has(slug)) {
    throw new Error("Slug inválido ou reservado. Use algo como selladm.");
  }
  const taken = await firestoreDb.serviceClient.findUnique({
    where: { solicitationLinkSlug: slug },
  });
  if (taken && taken.id !== excludeId) {
    throw new Error("Este link whitelabel já está em uso.");
  }
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
  const customSlug = String(formData.get("solicitationLinkSlug") || "").trim();
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

  const slug = slugify(customSlug || displayName) || `cliente-${Date.now()}`;
  await assertUniqueSlug(slug);

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
  const customSlug = String(formData.get("solicitationLinkSlug") || "").trim();
  const aiApiMode =
    String(formData.get("aiApiMode") || "platform") === "client"
      ? ServiceAiApiMode.client
      : ServiceAiApiMode.platform;
  const aiApiKey = String(formData.get("aiApiKey") || "").trim();

  const client = await firestoreDb.serviceClient.findFirst({
    where: { id, managedByOrgId: session.organizationId },
  });
  if (!client) throw new Error("Cliente não encontrado.");

  let slug = client.solicitationLinkSlug;
  if (customSlug) {
    slug = slugify(customSlug);
    await assertUniqueSlug(slug, id);
  }

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
      solicitationLinkSlug: slug,
      ...(aiApiKey
        ? { aiApiKeyMasked: `${aiApiKey.slice(0, 4)}••••${aiApiKey.slice(-4)}` }
        : {}),
    },
  });

  revalidatePath("/app/service/clientes");
  revalidatePath(`/app/service/clientes/${id}`);
}

function managerMembershipRole(roleLabel: string): MemberRole {
  return roleLabel === "gerente" ? MemberRole.master : MemberRole.operational;
}

export async function addServiceClientManagerAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterService();
    const serviceClientId = String(formData.get("serviceClientId") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const roleLabel = String(formData.get("roleLabel") || "gerente").trim() || "gerente";

    const client = await firestoreDb.serviceClient.findFirst({
      where: { id: serviceClientId, managedByOrgId: session.organizationId },
    });
    if (!client) throw new Error("Cliente não encontrado.");
    if (!name || !email.includes("@")) {
      throw new Error("Nome e e-mail obrigatórios.");
    }

    const alreadyManager = await firestoreDb.serviceClientManager.findFirst({
      where: { serviceClientId, email },
    });
    if (alreadyManager) throw new Error("Este e-mail já está vinculado.");

    const membershipRole = managerMembershipRole(roleLabel);
    let user = await firestoreDb.user.findUnique({ where: { email } });
    let tempPassword: string | undefined;

    if (!user) {
      const { hashPassword } = await import("@/lib/auth/password");
      tempPassword = `Convite@${randomBytes(3).toString("hex")}`;
      user = await firestoreDb.user.create({
        data: {
          email,
          name,
          passwordHash: await hashPassword(tempPassword),
        },
      });
    } else if (name.length >= 2) {
      await firestoreDb.user.update({ where: { id: user.id }, data: { name } });
    }

    const membership = await firestoreDb.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: client.clientOrgId,
        },
      },
    });
    if (!membership) {
      await firestoreDb.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: client.clientOrgId,
          role: membershipRole,
        },
      });
    } else {
      await firestoreDb.organizationMember.update({
        where: { id: membership.id },
        data: { role: membershipRole },
      });
    }

    await firestoreDb.serviceClientManager.create({
      data: {
        serviceClientId,
        userId: user.id,
        name: user.name || name,
        email,
        roleLabel,
      },
    });

    if (tempPassword) {
      const { sendTemplatedEmail } = await import("@/features/notifications/email-provider");
      await sendTemplatedEmail({
        toEmail: email,
        subject: "CotaCondo — acesso ao cliente",
        bodyText: [
          `Olá ${name},`,
          "",
          `Você foi vinculado como ${roleLabel} em ${client.displayName}.`,
          `E-mail: ${email}`,
          `Senha temporária: ${tempPassword}`,
          "Acesse /acesse para entrar.",
        ].join("\n"),
        template: "service_client_manager_invite",
        metadata: { serviceClientId, userId: user.id },
      });
    }

    revalidatePath(`/app/service/clientes/${serviceClientId}`);
    return {
      ok: true,
      message:
        tempPassword && process.env.NEXT_PUBLIC_APP_ENV !== "production"
          ? `Usuário vinculado. Senha temp: ${tempPassword}`
          : "Usuário vinculado ao cliente.",
    };
  } catch (error) {
    throw new Error(toPublicErrorMessage(error));
  }
}

export async function updateServiceClientManagerAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterService();
    const managerId = String(formData.get("managerId") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const roleLabel = String(formData.get("roleLabel") || "gerente").trim() || "gerente";

    if (!managerId || name.length < 2 || !email.includes("@")) {
      return { ok: false, message: "Dados inválidos." };
    }

    const manager = await firestoreDb.serviceClientManager.findUnique({
      where: { id: managerId },
    });
    if (!manager) return { ok: false, message: "Usuário não encontrado." };

    const client = await firestoreDb.serviceClient.findFirst({
      where: { id: manager.serviceClientId, managedByOrgId: session.organizationId },
    });
    if (!client) return { ok: false, message: "Cliente não encontrado." };

    if (manager.email !== email) {
      const taken = await firestoreDb.user.findUnique({ where: { email } });
      if (taken && taken.id !== manager.userId) {
        return { ok: false, message: "E-mail já em uso." };
      }
    }

    if (!manager.userId.startsWith("pending:")) {
      await firestoreDb.user.update({
        where: { id: manager.userId },
        data: { name, email },
      });
      const membership = await firestoreDb.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: manager.userId,
            organizationId: client.clientOrgId,
          },
        },
      });
      if (membership) {
        await firestoreDb.organizationMember.update({
          where: { id: membership.id },
          data: { role: managerMembershipRole(roleLabel) },
        });
      }
    }

    await firestoreDb.serviceClientManager.update({
      where: { id: managerId },
      data: { name, email, roleLabel },
    });

    revalidatePath(`/app/service/clientes/${client.id}`);
    return { ok: true, message: "Usuário atualizado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function removeServiceClientManagerAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterService();
    const managerId = String(formData.get("managerId") || "").trim();
    const manager = await firestoreDb.serviceClientManager.findUnique({
      where: { id: managerId },
    });
    if (!manager) return { ok: false, message: "Usuário não encontrado." };

    const client = await firestoreDb.serviceClient.findFirst({
      where: { id: manager.serviceClientId, managedByOrgId: session.organizationId },
    });
    if (!client) return { ok: false, message: "Cliente não encontrado." };

    await firestoreDb.serviceClientManager.delete({ where: { id: managerId } });

    if (!manager.userId.startsWith("pending:")) {
      const membership = await firestoreDb.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: manager.userId,
            organizationId: client.clientOrgId,
          },
        },
      });
      if (membership && membership.role !== MemberRole.external_approver) {
        await firestoreDb.organizationMember.delete({ where: { id: membership.id } });
      }
    }

    revalidatePath(`/app/service/clientes/${client.id}`);
    return { ok: true, message: "Vínculo removido." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function resendServiceClientManagerAccessAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await requireMasterService();
    const managerId = String(formData.get("managerId") || "").trim();
    const manager = await firestoreDb.serviceClientManager.findUnique({
      where: { id: managerId },
    });
    if (!manager) return { ok: false, message: "Usuário não encontrado." };

    const client = await firestoreDb.serviceClient.findFirst({
      where: { id: manager.serviceClientId, managedByOrgId: session.organizationId },
    });
    if (!client) return { ok: false, message: "Cliente não encontrado." };
    if (manager.userId.startsWith("pending:")) {
      return { ok: false, message: "Usuário pendente. Edite e salve para criar o acesso." };
    }

    const { hashPassword } = await import("@/lib/auth/password");
    const tempPassword = `Convite@${randomBytes(3).toString("hex")}`;
    await firestoreDb.user.update({
      where: { id: manager.userId },
      data: { passwordHash: await hashPassword(tempPassword) },
    });

    const { sendTemplatedEmail } = await import("@/features/notifications/email-provider");
    await sendTemplatedEmail({
      toEmail: manager.email,
      subject: "CotaCondo — reenvio de acesso",
      bodyText: [
        `Olá ${manager.name},`,
        "",
        `Seu acesso a ${client.displayName} foi reenviado.`,
        `E-mail: ${manager.email}`,
        `Senha temporária: ${tempPassword}`,
        "Acesse /acesse para entrar.",
      ].join("\n"),
      template: "service_client_manager_resend",
      metadata: { serviceClientId: client.id, userId: manager.userId },
    });

    revalidatePath(`/app/service/clientes/${client.id}`);
    return {
      ok: true,
      message:
        process.env.NEXT_PUBLIC_APP_ENV !== "production"
          ? `Acesso reenviado. Senha temp: ${tempPassword}`
          : "Acesso reenviado por e-mail.",
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function setServicePipelineStatusAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterService();
    const quotationId = String(formData.get("quotationId") || "").trim();
    const status = String(formData.get("status") || "").trim() as ServicePipelineStatus;

    const quotation = await firestoreDb.quotation.findFirst({
      where: { id: quotationId, serviceManagedByOrgId: session.organizationId },
    });
    if (!quotation) return { ok: false, message: "Cotação não encontrada." };

    await firestoreDb.quotation.update({
      where: { id: quotationId },
      data: { servicePipelineStatus: status },
    });

    revalidatePath("/app/service/cotacoes");
    revalidatePath(`/app/service/cotacoes/${quotationId}`);
    revalidatePath("/app");
    return { ok: true, message: "Pipeline atualizado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
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

export async function markServiceExternalApprovalAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireMasterService();
    const quotationId = String(formData.get("quotationId") || "").trim();
    const companyName = String(formData.get("companyName") || "").trim();
    const amountReais = String(formData.get("amountReais") || "").trim();

    if (!companyName || !amountReais) {
      return { ok: false, message: "Informe a empresa e o valor fechado (obrigatório)." };
    }

    const amountCents = Math.round(Number(amountReais.replace(",", ".")) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return { ok: false, message: "Valor inválido." };
    }

    const quotation = await firestoreDb.quotation.findFirst({
      where: { id: quotationId, serviceManagedByOrgId: session.organizationId },
    });
    if (!quotation) return { ok: false, message: "Cotação não encontrada." };

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
    return { ok: true, message: "Aprovação externa registrada." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function markServiceRejectedAction(formData: FormData): Promise<ActionResult> {
  try {
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
    return { ok: true, message: "Cotação marcada como recusada." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
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
