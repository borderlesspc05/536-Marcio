import { firestoreDb } from "@/lib/firebase/firestore-db";
import { createNotification } from "@/features/notifications/service";
import { sendTemplatedEmail } from "@/features/notifications/email-provider";

const DEFAULT_REFERRAL_CREDIT_CENTS = 2500;

export async function creditReferralOnPaidUpgrade(input: {
  organizationId?: string | null;
  planSlug?: string;
}) {
  if (!input.organizationId) return null;

  const plan = input.planSlug
    ? await firestoreDb.plan.findUnique({ where: { slug: input.planSlug } })
    : (
        await firestoreDb.subscription.findFirst({
          where: { organizationId: input.organizationId, status: "active" },
          include: { plan: true },
          orderBy: { createdAt: "desc" },
        })
      )?.plan;

  if (!plan || plan.isFree) return null;

  const members = await firestoreDb.organizationMember.findMany({
    where: { organizationId: input.organizationId },
    include: { user: true },
  });

  const referred = members.map((m) => m.user).find((u) => u.referredByUserId);
  if (!referred?.referredByUserId) return null;

  const yearMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const existing = await firestoreDb.referralReward.findFirst({
    where: {
      referrerUserId: referred.referredByUserId,
      referredUserId: referred.id,
      yearMonth,
      kind: "recurring_credit",
    },
  });
  if (existing) return existing;

  const reward = await firestoreDb.referralReward.create({
    data: {
      referrerUserId: referred.referredByUserId,
      referredUserId: referred.id,
      kind: "recurring_credit",
      amountCents: DEFAULT_REFERRAL_CREDIT_CENTS,
      notes: `Upgrade para ${plan.slug}`,
      yearMonth,
    },
  });

  await createNotification({
    userId: referred.referredByUserId,
    type: "referral.paid_upgrade",
    title: "Indicado virou plano pago",
    body: `${referred.name} ativou ${plan.name}. Crédito de indicação registrado.`,
    href: "/app/indicacoes",
    metadata: { rewardId: reward.id, planSlug: plan.slug },
  });

  const referrer = await firestoreDb.user.findUnique({ where: { id: referred.referredByUserId } });
  if (referrer) {
    await sendTemplatedEmail({
      toEmail: referrer.email,
      subject: "CotaCondo — indicação ativa (plano pago)",
      bodyText: `Olá ${referrer.name},\n\nSeu indicado ${referred.name} contratou um plano pago. Um crédito foi registrado no painel de indicações.\n`,
      template: "generic",
      metadata: { rewardId: reward.id },
    });
  }

  return reward;
}

export type ReferralStatus = "cadastrado_free" | "ativo_pago";

export async function resolveReferralStatus(referredUserId: string): Promise<ReferralStatus> {
  const memberships = await firestoreDb.organizationMember.findMany({
    where: { userId: referredUserId },
    select: { organizationId: true },
  });
  for (const membership of memberships) {
    const sub = await firestoreDb.subscription.findFirst({
      where: { organizationId: membership.organizationId, status: "active" },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    if (sub && !sub.plan.isFree) return "ativo_pago";
  }
  return "cadastrado_free";
}
