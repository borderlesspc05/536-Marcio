import { firestoreDb } from "@/lib/firebase/firestore-db";
import { notifyOrgMembers } from "@/features/notifications/service";
import { sendTemplatedEmail } from "@/features/notifications/email-provider";

/** Marca documentos aprovados/em análise com validade vencida como em_atraso. */
export async function markOverdueCompliance(organizationId?: string): Promise<number> {
  const now = new Date();
  const result = await firestoreDb.complianceDocument.updateMany({
    where: {
      status: { in: ["aprovado", "em_analise"] },
      validUntil: { lt: now },
      ...(organizationId ? { organizationId } : {}),
    },
    data: { status: "em_atraso" },
  });
  return result.count;
}

const MS_DAY = 1000 * 60 * 60 * 24;

function daysUntil(validUntil: Date, now: Date): number {
  return Math.ceil((validUntil.getTime() - now.getTime()) / MS_DAY);
}

/** Lembrete 5 dias antes do vencimento (prazo de 6 meses pós-aprovação). */
export async function remindComplianceExpiring(now = new Date()): Promise<number> {
  const docs = await firestoreDb.complianceDocument.findMany({
    where: {
      status: "aprovado",
      validUntil: {
        gte: now,
        lte: new Date(now.getTime() + 5 * MS_DAY),
      },
    },
    include: {
      organization: {
        include: { members: { include: { user: true } } },
      },
    },
  });

  let sent = 0;
  for (const doc of docs) {
    const daysLeft = daysUntil(doc.validUntil, now);
    if (daysLeft > 5 || daysLeft < 0) continue;

    const dedupeKey = `compliance-expiry:${doc.id}:d5`;
    const existing = await firestoreDb.reminderDispatch.findUnique({ where: { dedupeKey } });
    if (existing) continue;

    const daysLabel = daysLeft <= 1 ? "1 dia" : `${daysLeft} dias`;
    await notifyOrgMembers(doc.organizationId, {
      type: "compliance.expiry_reminder",
      title: `Compliance vence em ${daysLabel}`,
      body: `Atualize "${doc.documentType}" para não perder oportunidades por documentação atrasada.`,
      href: "/app/compliance",
      metadata: { documentId: doc.id, daysLeft },
    });

    for (const member of doc.organization.members) {
      await sendTemplatedEmail({
        toEmail: member.user.email,
        subject: `CotaCondo — documento vence em ${daysLabel}`,
        bodyText: [
          `Olá ${member.user.name},`,
          "",
          `O documento "${doc.documentType}" vence em ${daysLabel} (${doc.validUntil.toLocaleDateString("pt-BR")}).`,
          "Atualize o arquivo em Compliance para continuar recebendo oportunidades.",
          "",
          "Acesse /app/compliance",
        ].join("\n"),
        template: "compliance_expiry_reminder",
        metadata: { documentId: doc.id, daysLeft },
      });
    }

    await firestoreDb.reminderDispatch.create({
      data: { dedupeKey, kind: "compliance.expiry_reminder", entityId: doc.id },
    });
    sent += 1;
  }

  return sent;
}
