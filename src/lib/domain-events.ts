import { firestoreDb } from "@/lib/firebase/firestore-db";
import { createNotification, notifyOrgMembers } from "@/features/notifications/service";
import { sendTemplatedEmail } from "@/features/notifications/email-provider";
import { creditReferralOnPaidUpgrade } from "@/features/referrals/rewards";

export type DomainEventInput = {
  type: string;
  entityType: string;
  entityId: string;
  organizationId?: string | null;
  payload?: Record<string, unknown>;
};

/** @deprecated use DomainEventInput */
type EmitInput = DomainEventInput;

type DbLike = {
  domainEvent: {
    create: (args: { data: Record<string, unknown> }) => Promise<{
      type: string;
      entityType: string;
      entityId: string;
      organizationId?: string | null;
      payload?: string | null;
    }>;
  };
};

/**
 * Persiste o Domain Event sem side-effects.
 * Preferir emitDomainEvent; use isto só quando o caller precisa agrupar writes
 * e em seguida chamar notifyAfterDomainEvent / dispatchDomainEvent.
 */
export async function recordDomainEvent(db: DbLike, input: DomainEventInput) {
  return db.domainEvent.create({
    data: {
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      organizationId: input.organizationId ?? null,
      payload: input.payload ? JSON.stringify(input.payload) : null,
    },
  });
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Seam único: persiste Domain Event e dispara notify/email/referral. */
export async function emitDomainEvent(input: DomainEventInput) {
  const event = await recordDomainEvent(firestoreDb, input);

  await dispatchDomainEvent({
    type: event.type,
    entityType: event.entityType,
    entityId: event.entityId,
    organizationId: event.organizationId,
    payload: input.payload ?? {},
  });

  return event;
}

export async function dispatchDomainEvent(input: {
  type: string;
  entityType: string;
  entityId: string;
  organizationId?: string | null;
  payload: Record<string, unknown>;
}) {
  const payload = input.payload;
  const quotationId = asString(payload.quotationId) ?? (input.entityType === "quotation" ? input.entityId : undefined);
  const hrefQuotation = quotationId ? `/app/cotacoes/${quotationId}` : undefined;

  switch (input.type) {
    case "proposal.submitted": {
      const quotation = quotationId
        ? await firestoreDb.quotation.findUnique({ where: { id: quotationId } })
        : null;
      const orgId = quotation?.organizationId ?? asString(payload.solicitanteOrgId);
      if (orgId) {
        await notifyOrgMembers(orgId, {
          type: input.type,
          title: "Nova proposta recebida",
          body: asString(payload.summary) ?? "Um fornecedor enviou uma proposta para sua cotação.",
          href: quotationId ? `/app/cotacoes/${quotationId}` : hrefQuotation,
          metadata: payload,
        });
      }
      break;
    }
    case "quotation.min_proposals_reached": {
      const orgId = input.organizationId;
      if (orgId) {
        await notifyOrgMembers(orgId, {
          type: input.type,
          title: "Meta mínima de propostas atingida",
          body: "Sua cotação já tem propostas suficientes para comparação.",
          href: hrefQuotation,
          metadata: payload,
        });
        const members = await firestoreDb.organizationMember.findMany({
          where: { organizationId: orgId },
          include: { user: true },
        });
        for (const member of members) {
          await sendTemplatedEmail({
            toEmail: member.user.email,
            subject: "CotaCondo — meta mínima de propostas atingida",
            bodyText: `Olá ${member.user.name},\n\nA cotação ${asString(payload.code) ?? quotationId ?? ""} atingiu a meta mínima de propostas. Acesse o comparativo para negociar ou aprovar.\n`,
            template: "min_proposals_reached",
            metadata: { quotationId, organizationId: orgId },
          });
        }
      }
      break;
    }
    case "negotiation.started":
    case "negotiation.message": {
      const targets = [asString(payload.solicitanteOrgId), asString(payload.supplierOrgId)].filter(
        Boolean,
      ) as string[];
      for (const orgId of targets) {
        await notifyOrgMembers(orgId, {
          type: input.type,
          title: input.type === "negotiation.started" ? "Negociação iniciada" : "Nova mensagem na negociação",
          body: asString(payload.preview) ?? "Há uma atualização na negociação da cotação.",
          href: hrefQuotation,
          metadata: payload,
        });
      }
      break;
    }
    case "quotation.approved": {
      if (input.organizationId) {
        await notifyOrgMembers(input.organizationId, {
          type: input.type,
          title: "Cotação aprovada",
          body: "Uma proposta foi aprovada e as demais foram encerradas.",
          href: hrefQuotation,
          metadata: payload,
        });
      }
      const supplierOrgId = asString(payload.supplierOrgId);
      if (supplierOrgId) {
        await notifyOrgMembers(supplierOrgId, {
          type: input.type,
          title: "Sua proposta foi aprovada",
          body: "Parabéns — a proposta foi escolhida pelo solicitante.",
          href: "/app/oportunidades",
          metadata: payload,
        });
        const suppliers = await firestoreDb.organizationMember.findMany({
          where: { organizationId: supplierOrgId },
          include: { user: true },
        });
        for (const member of suppliers) {
          await sendTemplatedEmail({
            toEmail: member.user.email,
            subject: "CotaCondo — proposta aprovada",
            bodyText: `Olá ${member.user.name},\n\nSua proposta foi aprovada na cotação ${quotationId ?? ""}.\n`,
            template: "quotation_approved",
            metadata: payload,
          });
        }
      }
      break;
    }
    case "quotation.finalized_others":
    case "quotation.finalizada_outros":
    case "quotation.outros": {
      if (input.organizationId) {
        await notifyOrgMembers(input.organizationId, {
          type: input.type,
          title: "Cotação finalizada (Outros)",
          body: asString(payload.providerName)
            ? `Finalizada com fornecedor externo: ${asString(payload.providerName)}.`
            : "A cotação foi encerrada no fluxo Outros.",
          href: hrefQuotation,
          metadata: payload,
        });
      }
      break;
    }
    case "quotation.status_changed": {
      if (input.organizationId) {
        await notifyOrgMembers(input.organizationId, {
          type: input.type,
          title: "Status da cotação atualizado",
          body: `Novo status: ${asString(payload.status) ?? "atualizado"}.`,
          href: hrefQuotation,
          metadata: payload,
        });
      }
      break;
    }
    case "quotation.invite_created": {
      const supplierOrgId = asString(payload.supplierOrgId) ?? input.organizationId;
      if (supplierOrgId) {
        await notifyOrgMembers(supplierOrgId, {
          type: input.type,
          title: "Convite de cotação",
          body: "Você foi convidado a enviar uma proposta.",
          href: "/app/oportunidades",
          metadata: payload,
        });
        const members = await firestoreDb.organizationMember.findMany({
          where: { organizationId: supplierOrgId },
          include: { user: true },
        });
        for (const member of members) {
          await sendTemplatedEmail({
            toEmail: member.user.email,
            subject: "CotaCondo — novo convite de cotação",
            bodyText: `Olá ${member.user.name},\n\nHá uma nova oportunidade de cotação aguardando sua proposta ou declínio.\n`,
            template: "quotation_invite",
            metadata: payload,
          });
        }
      }
      break;
    }
    case "compliance.updated": {
      const orgId = input.organizationId;
      if (orgId) {
        await notifyOrgMembers(orgId, {
          type: input.type,
          title: "Compliance atualizado",
          body: asString(payload.message) ?? "Há uma atualização nos seus documentos de compliance.",
          href: "/app/compliance",
          metadata: payload,
        });
      }
      const masters = await firestoreDb.organization.findMany({
        where: { type: "master_admin" },
        select: { id: true },
      });
      for (const masterOrg of masters) {
        await notifyOrgMembers(masterOrg.id, {
          type: input.type,
          title: "Compliance — revisão",
          body: asString(payload.message) ?? "Documento de compliance atualizado na fila.",
          href: "/app/plataforma/compliance",
          metadata: payload,
        });
      }
      await sendComplianceEmails(payload, orgId);
      break;
    }
    case "commission.recorded":
    case "commission.created":
    case "commission.expected": {
      const admOrgId = asString(payload.administradoraOrgId) ?? input.organizationId;
      if (admOrgId) {
        await notifyOrgMembers(admOrgId, {
          type: input.type,
          title: "Nova comissão registrada",
          body: `Expectativa de R$ ${((asNumber(payload.commissionCents) ?? 0) / 100).toFixed(2)} na comissão.`,
          href: "/app/financeiro",
          metadata: payload,
          mastersOnly: true,
        });
      }
      break;
    }
    case "subscription.activated": {
      await creditReferralOnPaidUpgrade({
        organizationId: input.organizationId ?? asString(payload.organizationId),
        planSlug: asString(payload.planSlug),
      });
      break;
    }
    case "service_quotation.external_approved": {
      if (!quotationId) break;
      const quotation = await firestoreDb.quotation.findUnique({
        where: { id: quotationId },
        include: {
          condominium: true,
          organization: true,
          proposals: {
            where: { status: "aprovada" },
            include: {
              organization: true,
              conditions: { orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
        },
      });
      if (!quotation) break;

      const winning = quotation.proposals[0];
      const amountCents = winning?.conditions[0]?.amountCents;
      const reason = asString(payload.reason) ?? "";
      const requesterEmail = quotation.requesterEmail;

      if (requesterEmail) {
        await sendTemplatedEmail({
          toEmail: requesterEmail,
          subject: `Cotação aprovada — ${quotation.publicId}`,
          bodyText: [
            `A cotação ${quotation.publicId} foi aprovada pelo aprovador externo.`,
            `Motivo: ${reason}`,
            "",
            "Dados do condomínio:",
            `Nome: ${quotation.condominium.name}`,
            `Endereço: ${quotation.condominium.address}`,
            `CNPJ: ${quotation.condominium.document ?? "—"}`,
            "",
            `Valor da proposta vencedora: R$ ${((amountCents ?? 0) / 100).toFixed(2)}`,
            `E-mail do solicitante: ${requesterEmail}`,
          ].join("\n"),
          template: "external_approval_solicitante",
          metadata: { quotationId },
        });
      }

      await notifyOrgMembers(quotation.organizationId, {
        type: input.type,
        title: "Aprovação externa confirmada",
        body: `${quotation.publicId} — ${reason.slice(0, 120)}`,
        href: `/app/cotacoes/${quotationId}`,
        metadata: payload,
      });

      if (winning) {
        const supplierMembers = await firestoreDb.organizationMember.findMany({
          where: { organizationId: winning.organizationId, role: "master" },
          include: { user: true },
        });
        for (const member of supplierMembers) {
          await sendTemplatedEmail({
            toEmail: member.user.email,
            subject: `Proposta aprovada — ${quotation.publicId}`,
            bodyText: [
              `Sua proposta foi aprovada na cotação ${quotation.publicId}.`,
              `Motivo: ${reason}`,
              "",
              "Dados do condomínio:",
              `Nome: ${quotation.condominium.name}`,
              `Endereço: ${quotation.condominium.address}`,
              "",
              `Valor: R$ ${((amountCents ?? 0) / 100).toFixed(2)}`,
              `Contato solicitante: ${requesterEmail ?? "—"}`,
            ].join("\n"),
            template: "external_approval_fornecedor",
            metadata: { quotationId, proposalId: winning.id },
          });
        }
      }
      break;
    }
    case "service_quotation.external_rejected": {
      if (!quotationId) break;
      const quotation = await firestoreDb.quotation.findUnique({
        where: { id: quotationId },
      });
      if (!quotation?.requesterEmail) break;
      await sendTemplatedEmail({
        toEmail: quotation.requesterEmail,
        subject: `Cotação recusada — ${quotation.publicId}`,
        bodyText: `A cotação ${quotation.publicId} foi recusada pelo aprovador externo.\nMotivo: ${asString(payload.reason) ?? ""}`,
        template: "external_rejection_solicitante",
        metadata: { quotationId },
      });
      await notifyOrgMembers(quotation.organizationId, {
        type: input.type,
        title: "Cotação recusada pelo aprovador",
        body: asString(payload.reason) ?? quotation.publicId,
        href: `/app/service/cotacoes/${quotationId}`,
        metadata: payload,
      });
      break;
    }
    case "invite.reinforced": {
      const supplierOrgId = asString(payload.supplierOrgId) ?? input.organizationId;
      const inviteId = input.entityId;
      const publicId = asString(payload.publicId) ?? "";
      if (!supplierOrgId) break;
      await notifyOrgMembers(supplierOrgId, {
        type: input.type,
        title: "Pedido reforçado pelo solicitante",
        body: publicId
          ? `A cotação ${publicId} aguarda sua proposta. Por favor, responda em breve.`
          : "O solicitante reforçou um pedido de cotação.",
        href: `/app/oportunidades?inviteId=${inviteId}`,
        metadata: payload,
      });
      const members = await firestoreDb.organizationMember.findMany({
        where: { organizationId: supplierOrgId },
        include: { user: true },
      });
      for (const member of members) {
        await sendTemplatedEmail({
          toEmail: member.user.email,
          subject: publicId
            ? `CotaCondo — reforço de pedido (${publicId})`
            : "CotaCondo — reforço de pedido",
          bodyText: `Olá ${member.user.name},\n\nO solicitante reforçou o pedido da cotação ${publicId || inviteId}. Envie a proposta ou decline a oportunidade.\n`,
          template: "quotation_invite",
          metadata: { inviteId, quotationId },
        });
      }
      break;
    }
    case "invite.declined": {
      const solicitanteOrgId = asString(payload.solicitanteOrgId);
      if (solicitanteOrgId) {
        await notifyOrgMembers(solicitanteOrgId, {
          type: input.type,
          title: "Convite declinado",
          body: asString(payload.reason) ?? "Um fornecedor declinou a oportunidade.",
          href: hrefQuotation,
          metadata: payload,
        });
      }
      break;
    }
    case "checkout.paid":
    case "quotation.created":
    case "distribution.completed":
    case "quotation.max_proposals_reached":
    case "negotiation.counter_offer":
      // Persistidos para auditoria; side-effects adicionais entram aqui quando existirem.
      break;
    default:
      break;
  }
}

async function sendComplianceEmails(payload: Record<string, unknown>, orgId?: string | null) {
  if (!orgId) return;
  const members = await firestoreDb.organizationMember.findMany({
    where: { organizationId: orgId },
    include: { user: true },
  });
  for (const member of members) {
    await sendTemplatedEmail({
      toEmail: member.user.email,
      subject: "CotaCondo — atualização de compliance",
      bodyText: `Olá ${member.user.name},\n\n${asString(payload.message) ?? "Seu compliance foi atualizado."}\n`,
      template: "compliance_updated",
      metadata: payload,
    });
  }
}

/** Reprocessa eventos ainda não notificados (smoke / backfill leve). */
export async function createNotificationForUser(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  organizationId?: string;
}) {
  return createNotification(input);
}
