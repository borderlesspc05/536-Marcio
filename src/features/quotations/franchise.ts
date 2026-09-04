import { firestoreDb } from "@/lib/firebase/firestore-db";

export type FranchiseBalance = {
  yearMonth: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  isUnlimited: boolean;
  canCreate: boolean;
};

export function currentYearMonth(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function resolveLimit(input: {
  overrideQuota: number | null | undefined;
  hasOverride: boolean;
  planQuota: number | null | undefined;
  globalFreeQuota: number | null | undefined;
}): number | null {
  if (input.hasOverride) {
    return input.overrideQuota ?? null;
  }
  if (input.planQuota !== undefined) {
    return input.planQuota;
  }
  return input.globalFreeQuota ?? 15;
}

async function loadFranchiseContext(organizationId: string, yearMonth: string) {
  const [settings, override, subscription, usage] = await Promise.all([
    firestoreDb.platformSettings.findUnique({ where: { id: "default" } }),
    firestoreDb.planOverride.findUnique({ where: { organizationId } }),
    firestoreDb.subscription.findFirst({
      where: { organizationId, status: "active" },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    firestoreDb.franchiseUsage.findUnique({
      where: { organizationId_yearMonth: { organizationId, yearMonth } },
    }),
  ]);

  const limit = resolveLimit({
    hasOverride: Boolean(override),
    overrideQuota: override?.monthlyQuota,
    planQuota: subscription ? subscription.plan.monthlyQuota : undefined,
    globalFreeQuota: settings?.freeQuotaSolicitante,
  });

  return { limit, used: usage?.usedCount ?? 0 };
}

function toBalance(yearMonth: string, limit: number | null, used: number): FranchiseBalance {
  const isUnlimited = limit === null;
  const remaining = isUnlimited ? null : Math.max(limit - used, 0);
  return {
    yearMonth,
    limit,
    used,
    remaining,
    isUnlimited,
    canCreate: isUnlimited || (remaining ?? 0) > 0,
  };
}

export async function getFranchiseBalance(organizationId: string): Promise<FranchiseBalance> {
  const yearMonth = currentYearMonth();
  const { limit, used } = await loadFranchiseContext(organizationId, yearMonth);
  return toBalance(yearMonth, limit, used);
}

export async function createQuotationConsumingFranchise(input: {
  organizationId: string;
  condominiumId: string;
  categoryId: string;
  serviceItemId: string;
  urgency: "baixa" | "media" | "alta" | "critica";
  description: string;
  minProposals: number;
  maxProposals: number;
  createdByUserId: string;
  publicId: string;
}) {
  const yearMonth = currentYearMonth();

  return firestoreDb.$transaction(async (tx) => {
    const [settings, override, subscription, usage] = await Promise.all([
      tx.platformSettings.findUnique({ where: { id: "default" } }),
      tx.planOverride.findUnique({ where: { organizationId: input.organizationId } }),
      tx.subscription.findFirst({
        where: { organizationId: input.organizationId, status: "active" },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      }),
      tx.franchiseUsage.findUnique({
        where: {
          organizationId_yearMonth: {
            organizationId: input.organizationId,
            yearMonth,
          },
        },
      }),
    ]);

    const limit = resolveLimit({
      hasOverride: Boolean(override),
      overrideQuota: override?.monthlyQuota,
      planQuota: subscription ? subscription.plan.monthlyQuota : undefined,
      globalFreeQuota: settings?.freeQuotaSolicitante,
    });

    const used = usage?.usedCount ?? 0;
    if (limit !== null && used >= limit) {
      throw new Error("FRANCHISE_EXHAUSTED");
    }

    await tx.franchiseUsage.upsert({
      where: {
        organizationId_yearMonth: {
          organizationId: input.organizationId,
          yearMonth,
        },
      },
      create: { organizationId: input.organizationId, yearMonth, usedCount: 1 },
      update: { usedCount: { increment: 1 } },
    });

    const quotation = await tx.quotation.create({
      data: {
        publicId: input.publicId,
        organizationId: input.organizationId,
        condominiumId: input.condominiumId,
        categoryId: input.categoryId,
        serviceItemId: input.serviceItemId,
        urgency: input.urgency,
        description: input.description,
        minProposals: input.minProposals,
        maxProposals: input.maxProposals,
        status: "aberta",
        createdByUserId: input.createdByUserId,
      },
    });

    await tx.domainEvent.create({
      data: {
        type: "quotation.created",
        entityType: "quotation",
        entityId: quotation.id,
        organizationId: input.organizationId,
        payload: JSON.stringify({ publicId: quotation.publicId }),
      },
    });

    return quotation;
  });
}
