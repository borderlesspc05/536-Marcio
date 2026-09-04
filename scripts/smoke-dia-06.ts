import { firestoreDb } from "../src/lib/firebase/firestore-db";
import { createNotification, getUnreadCount } from "../src/features/notifications/service";
import { notifyAfterDomainEvent } from "../src/features/notifications/notify-after";
import { runReminderJob } from "../src/features/notifications/reminders";
import { resolveReferralStatus, creditReferralOnPaidUpgrade } from "../src/features/referrals/rewards";
import { calculateProrationCents } from "../src/features/billing/money";
import { getPlatformReports } from "../src/features/platform/reports";

async function main() {
  const proration = calculateProrationCents({
    fromPriceCents: 10000,
    toPriceCents: 20000,
    periodStart: new Date("2026-07-01T00:00:00Z"),
    periodEnd: new Date("2026-08-01T00:00:00Z"),
    asOf: new Date("2026-07-16T00:00:00Z"),
  });
  if (proration < 4000 || proration > 6000) {
    throw new Error(`Pró-rata inesperado: ${proration}`);
  }
  console.log(`Pró-rata OK: ${proration}`);

  const sindico = await firestoreDb.user.findFirst({
    where: { email: "sindico@demo.cotacondo.com.br" },
  });
  const admMaster = await firestoreDb.user.findFirst({
    where: { email: "adm.master@demo.cotacondo.com.br" },
  });
  const admOp = await firestoreDb.user.findFirst({
    where: { email: "adm.operacional@demo.cotacondo.com.br" },
  });
  if (!sindico || !admMaster) throw new Error("Usuários demo ausentes");

  await createNotification({
    userId: sindico.id,
    type: "smoke.test",
    title: "Smoke Dia 6",
    body: "Notificação de teste",
    href: "/app/notificacoes",
  });
  const unread = await getUnreadCount(sindico.id);
  if (unread < 1) throw new Error("Unread deveria ser ≥1");
  console.log(`Notificação + badge OK: unread=${unread}`);

  const org = await firestoreDb.organization.findFirst({ where: { type: "sindico" } });
  if (!org) throw new Error("Org síndico ausente");

  await notifyAfterDomainEvent({
    type: "quotation.min_proposals_reached",
    entityType: "quotation",
    entityId: "smoke-quotation",
    organizationId: org.id,
    payload: { quotationId: "smoke-quotation", code: "COT-SMOKE", proposalsCount: 3, minProposals: 3 },
  });

  const email = await firestoreDb.emailOutbox.findFirst({
    where: { template: "min_proposals_reached" },
    orderBy: { createdAt: "desc" },
  });
  if (!email) throw new Error("E-mail de meta mínima não gravado no outbox");
  console.log(`E-mail outbox OK: ${email.subject}`);

  if (admMaster) {
    await notifyAfterDomainEvent({
      type: "commission.expected",
      entityType: "commission_entry",
      entityId: "smoke-commission",
      organizationId: (
        await firestoreDb.organizationMember.findFirstOrThrow({ where: { userId: admMaster.id } })
      ).organizationId,
      payload: {
        commissionCents: 5000,
        administradoraOrgId: (
          await firestoreDb.organizationMember.findFirstOrThrow({ where: { userId: admMaster.id } })
        ).organizationId,
      },
    });
  }

  const masterNotif = await firestoreDb.notification.findFirst({
    where: { userId: admMaster.id, type: "commission.expected" },
    orderBy: { createdAt: "desc" },
  });
  if (!masterNotif) throw new Error("Master deveria receber notificação de comissão");

  if (admOp) {
    const opNotif = await firestoreDb.notification.findFirst({
      where: { userId: admOp.id, type: "commission.expected", createdAt: { gte: masterNotif.createdAt } },
    });
    if (opNotif) throw new Error("Operacional NÃO deveria receber comissão no sino");
  }
  console.log("Comissão só Master OK");

  // Forçar cotação antiga para lembrete
  const oldQuotation = await firestoreDb.quotation.findFirst({
    where: { status: { in: ["aberta", "em_negociacao"] } },
  });
  if (oldQuotation) {
    await firestoreDb.quotation.update({
      where: { id: oldQuotation.id },
      data: { createdAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000) },
    });
    await firestoreDb.reminderDispatch.deleteMany({
      where: { entityId: oldQuotation.id, kind: "reminder.solicitante" },
    });
  }
  const reminders = await runReminderJob();
  console.log(`Lembretes OK: ${JSON.stringify(reminders)}`);

  await firestoreDb.user.update({
    where: { id: sindico.id },
    data: { referredByUserId: admMaster.id },
  });
  const statusFree = await resolveReferralStatus(sindico.id);
  // pode já estar pago se smoke-05 rodou
  console.log(`Referral status: ${statusFree}`);

  const admOrgId = (
    await firestoreDb.organizationMember.findFirstOrThrow({ where: { userId: sindico.id } })
  ).organizationId;
  await creditReferralOnPaidUpgrade({
    organizationId: admOrgId,
    planSlug: "sindico-pago",
  });
  const reward = await firestoreDb.referralReward.findFirst({
    where: { referrerUserId: admMaster.id, referredUserId: sindico.id },
  });
  if (!reward) {
    // se plano ainda free, credit não cria — força via plan pago check
    const gatePlan = await firestoreDb.plan.findUnique({ where: { slug: "sindico-pago" } });
    if (gatePlan && !gatePlan.isFree) {
      const sub = await firestoreDb.subscription.findFirst({
        where: { organizationId: admOrgId, status: "active" },
        include: { plan: true },
      });
      if (sub && !sub.plan.isFree && !reward) {
        throw new Error("Reward de indicação deveria existir após upgrade pago");
      }
    }
  }
  console.log(`Referral reward: ${reward ? reward.amountCents : "n/a (free)"}`);

  await firestoreDb.platformSettings.update({
    where: { id: "default" },
    data: {
      freeQuotaSolicitante: 15,
      reminderDaysJson: "[5,10]",
      supplierProQuota: 30,
      supplierPremiumQuota: 100,
    },
  });
  const reports = await getPlatformReports();
  if (!reports.planConversion.length) throw new Error("Relatórios sem conversão de planos");
  console.log(
    `Relatórios OK: planos=${reports.planConversion.length} outros=${reports.quotationsOutros}`,
  );

  console.log("SMOKE DIA 6 OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await firestoreDb.$disconnect();
  });
