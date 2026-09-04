import { firestoreDb } from "@/lib/firebase/firestore-db";
import { notifyOrgMembers } from "@/features/notifications/service";
import { sendTemplatedEmail } from "@/features/notifications/email-provider";

function parseReminderDays(raw: string | null | undefined): number[] {
  try {
    const value = JSON.parse(raw || "[5,10]") as unknown;
    if (!Array.isArray(value)) return [5, 10];
    return value.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [5, 10];
  }
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

async function alreadySent(dedupeKey: string): Promise<boolean> {
  const existing = await firestoreDb.reminderDispatch.findUnique({ where: { dedupeKey } });
  return Boolean(existing);
}

async function markSent(dedupeKey: string, kind: string, entityId: string) {
  await firestoreDb.reminderDispatch.create({
    data: { dedupeKey, kind, entityId },
  });
}

async function remindSolicitantes(reminderDays: number[], now: Date) {
  const open = await firestoreDb.quotation.findMany({
    where: { status: { in: ["aberta", "em_negociacao"] } },
    include: {
      organization: { include: { members: { include: { user: true } } } },
    },
  });

  let sent = 0;
  for (const quotation of open) {
    const age = daysBetween(quotation.createdAt, now);
    for (const day of reminderDays) {
      if (age < day) continue;
      const dedupeKey = `solicitante:${quotation.id}:day:${day}`;
      if (await alreadySent(dedupeKey)) continue;

      await notifyOrgMembers(quotation.organizationId, {
        type: "reminder.solicitante",
        title: `Lembrete ${day} dias — finalize a cotação`,
        body: `A cotação ${quotation.publicId} segue aberta. Aprove uma proposta ou use "Outros" para encerrar.`,
        href: `/app/cotacoes/${quotation.id}`,
        metadata: { quotationId: quotation.id, day },
      });

      for (const member of quotation.organization.members) {
        await sendTemplatedEmail({
          toEmail: member.user.email,
          subject: `CotaCondo — lembrete ${day} dias (${quotation.publicId})`,
          bodyText: `Olá ${member.user.name},\n\nSua cotação ${quotation.publicId} está aberta há cerca de ${day} dias. Por favor, aprove uma proposta ou finalize com "Outros".\n`,
          template: "reminder_solicitante",
          metadata: { quotationId: quotation.id, day },
        });
      }

      await markSent(dedupeKey, "reminder.solicitante", quotation.id);
      sent += 1;
    }
  }
  return sent;
}

async function remindFornecedores(now: Date) {
  const invites = await firestoreDb.quotationInvite.findMany({
    where: { status: "pendente", declinedAt: null },
    include: {
      quotation: true,
      supplier: { include: { members: { include: { user: true } } } },
      proposal: true,
    },
  });

  let sent = 0;
  for (const invite of invites) {
    if (["aprovada", "finalizada_outros", "cancelada", "encerrada"].includes(invite.quotation.status)) {
      continue;
    }
    if (invite.proposal) continue;

    const age = daysBetween(invite.createdAt, now);
    if (age < 1) continue;

    const dedupeKey = `fornecedor:${invite.id}:day:${age}`;
    if (await alreadySent(dedupeKey)) continue;

    await notifyOrgMembers(invite.supplierOrgId, {
      type: "reminder.fornecedor",
      title: "Lembrete — responda o convite",
      body: `Envie uma proposta ou decline a cotação ${invite.quotation.publicId}.`,
      href: "/app/oportunidades",
      metadata: { inviteId: invite.id, quotationId: invite.quotationId },
    });

    for (const member of invite.supplier.members) {
      await sendTemplatedEmail({
        toEmail: member.user.email,
        subject: `CotaCondo — lembrete de convite (${invite.quotation.publicId})`,
        bodyText: `Olá ${member.user.name},\n\nVocê ainda não respondeu ao convite da cotação ${invite.quotation.publicId}. Envie uma proposta ou decline a oportunidade.\n`,
        template: "reminder_fornecedor",
        metadata: { inviteId: invite.id },
      });
    }

    await markSent(dedupeKey, "reminder.fornecedor", invite.id);
    sent += 1;
  }
  return sent;
}

export async function runReminderJob(now = new Date()) {
  const settings = await firestoreDb.platformSettings.findUnique({ where: { id: "default" } });
  const reminderDays = parseReminderDays(settings?.reminderDaysJson);
  const solicitante = await remindSolicitantes(reminderDays, now);
  const fornecedor = await remindFornecedores(now);
  return { solicitante, fornecedor, reminderDays };
}
