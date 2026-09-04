import { firestoreDb } from "@/lib/firebase/firestore-db";
import { regionHintFromAddress } from "@/features/opportunities/analysis";

export type PlatformReports = {
  planConversion: Array<{ slug: string; name: string; count: number; isFree: boolean }>;
  referralsActivePaid: number;
  referralsFree: number;
  commissionVolumeCents: number;
  quotationsOutros: number;
  quotationsApproved: number;
  topServices: Array<{ serviceItemId: string; name: string; count: number }>;
  avgPriceByService: Array<{
    serviceItemId: string;
    name: string;
    avgCents: number;
    samples: number;
  }>;
  avgAcceptHours: number | null;
  avgProposalHours: number | null;
};

export async function getPlatformReports(): Promise<PlatformReports> {
  const [subs, outros, approved, commissionAgg, quotations, invites] = await Promise.all([
    firestoreDb.subscription.findMany({
      where: { status: "active" },
      include: { plan: true },
    }),
    firestoreDb.quotation.count({ where: { status: "finalizada_outros" } }),
    firestoreDb.quotation.count({ where: { status: "aprovada" } }),
    firestoreDb.commissionEntry.aggregate({ _sum: { volumeCents: true, commissionCents: true } }),
    firestoreDb.quotation.findMany({
      include: {
        serviceItem: true,
        condominium: true,
        proposals: { include: { conditions: true } },
      },
      take: 500,
      orderBy: { createdAt: "desc" },
    }),
    firestoreDb.quotationInvite.findMany({
      where: { OR: [{ acceptedAt: { not: null } }, { proposal: { isNot: null } }] },
      include: { proposal: true },
      take: 500,
    }),
  ]);

  const bySlug = new Map<string, { slug: string; name: string; count: number; isFree: boolean }>();
  for (const sub of subs) {
    const current = bySlug.get(sub.plan.slug) ?? {
      slug: sub.plan.slug,
      name: sub.plan.name,
      count: 0,
      isFree: sub.plan.isFree,
    };
    current.count += 1;
    bySlug.set(sub.plan.slug, current);
  }

  const referredUsers = await firestoreDb.user.findMany({
    where: { referredByUserId: { not: null } },
    select: { id: true },
  });

  let referralsActivePaid = 0;
  let referralsFree = 0;
  for (const user of referredUsers) {
    const memberships = await firestoreDb.organizationMember.findMany({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    let paid = false;
    for (const m of memberships) {
      const sub = await firestoreDb.subscription.findFirst({
        where: { organizationId: m.organizationId, status: "active" },
        include: { plan: true },
      });
      if (sub && !sub.plan.isFree) {
        paid = true;
        break;
      }
    }
    if (paid) referralsActivePaid += 1;
    else referralsFree += 1;
  }

  const serviceCount = new Map<string, { name: string; count: number }>();
  const priceBuckets = new Map<string, { name: string; total: number; samples: number }>();
  for (const q of quotations) {
    const key = q.serviceItemId;
    const current = serviceCount.get(key) ?? { name: q.serviceItem.name, count: 0 };
    current.count += 1;
    serviceCount.set(key, current);

    for (const proposal of q.proposals) {
      for (const condition of proposal.conditions) {
        const bucket = priceBuckets.get(key) ?? {
          name: q.serviceItem.name,
          total: 0,
          samples: 0,
        };
        bucket.total += condition.amountCents;
        bucket.samples += 1;
        priceBuckets.set(key, bucket);
      }
    }
    // regionHint available for future BI
    void regionHintFromAddress(q.condominium.address);
  }

  const acceptHours: number[] = [];
  const proposalHours: number[] = [];
  for (const invite of invites) {
    if (invite.acceptedAt) {
      acceptHours.push(
        (invite.acceptedAt.getTime() - invite.createdAt.getTime()) / (1000 * 60 * 60),
      );
    }
    if (invite.proposal) {
      proposalHours.push(
        (invite.proposal.createdAt.getTime() - invite.createdAt.getTime()) / (1000 * 60 * 60),
      );
    }
  }

  const avg = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

  return {
    planConversion: Array.from(bySlug.values()).sort((a, b) => b.count - a.count),
    referralsActivePaid,
    referralsFree,
    commissionVolumeCents: commissionAgg._sum.volumeCents ?? 0,
    quotationsOutros: outros,
    quotationsApproved: approved,
    topServices: Array.from(serviceCount.entries())
      .map(([serviceItemId, value]) => ({
        serviceItemId,
        name: value.name,
        count: value.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    avgPriceByService: Array.from(priceBuckets.entries())
      .map(([serviceItemId, value]) => ({
        serviceItemId,
        name: value.name,
        avgCents: Math.round(value.total / value.samples),
        samples: value.samples,
      }))
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 8),
    avgAcceptHours: avg(acceptHours),
    avgProposalHours: avg(proposalHours),
  };
}
