import { firestoreDb } from "@/lib/firebase/firestore-db";
import { getPlanGate, type PlanFeatures } from "@/features/billing/plan-gate";
import { currentYearMonth } from "@/features/quotations/franchise";

export type SupplierFranchiseBalance = {
  yearMonth: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  isUnlimited: boolean;
  canSubmitProposal: boolean;
};

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
  return input.globalFreeQuota ?? 1;
}

function parseFeatures(json: string | null | undefined): PlanFeatures & {
  segmentsIncluded?: number;
  allowExtraCategoriesFree?: boolean;
} {
  try {
    return JSON.parse(json || "{}") as PlanFeatures & {
      segmentsIncluded?: number;
      allowExtraCategoriesFree?: boolean;
    };
  } catch {
    return {};
  }
}

async function loadContext(organizationId: string, yearMonth: string) {
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
    globalFreeQuota: settings?.freeQuotaFornecedor,
  });

  return { limit, used: usage?.usedCount ?? 0, subscription, settings, override };
}

function toBalance(yearMonth: string, limit: number | null, used: number): SupplierFranchiseBalance {
  const isUnlimited = limit === null;
  const remaining = isUnlimited ? null : Math.max(limit - used, 0);
  return {
    yearMonth,
    limit,
    used,
    remaining,
    isUnlimited,
    canSubmitProposal: isUnlimited || (remaining ?? 0) > 0,
  };
}

export async function getSupplierFranchiseBalance(
  organizationId: string,
): Promise<SupplierFranchiseBalance> {
  const yearMonth = currentYearMonth();
  const { limit, used } = await loadContext(organizationId, yearMonth);
  return toBalance(yearMonth, limit, used);
}

export type SupplierSegmentLink = {
  id: string;
  categoryId: string;
  categoryName: string;
  serviceItemId: string | null;
  segmentName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isIncluded: boolean;
};

export type SupplierPlanInfo = {
  planName: string;
  planSlug: string;
  isFree: boolean;
  monthlyQuota: number | null;
  categoriesIncluded: number;
  segmentsIncluded: number;
  allowExtraCategoriesFree: boolean;
  categoryIds: string[];
  segmentIds: string[];
  categories: Array<{ id: string; name: string; slug: string; isIncluded: boolean }>;
  links: SupplierSegmentLink[];
  franchise: SupplierFranchiseBalance;
  priceCents: number;
};

export async function getSupplierPlanInfo(organizationId: string): Promise<SupplierPlanInfo> {
  const yearMonth = currentYearMonth();
  const { limit, used, subscription, override } = await loadContext(organizationId, yearMonth);
  const franchise = toBalance(yearMonth, limit, used);

  const plan = subscription?.plan;
  const planFeatures = parseFeatures(plan?.featuresJson);
  const overrideFeatures = parseFeatures(override?.featuresJson);
  const features = { ...planFeatures, ...overrideFeatures };

  const links = await firestoreDb.organizationCategory.findMany({
    where: { organizationId },
    include: { category: true, serviceItem: true },
    orderBy: { createdAt: "asc" },
  });

  const uniqueCategories = new Map<string, { id: string; name: string; slug: string; isIncluded: boolean }>();
  for (const link of links) {
    if (!uniqueCategories.has(link.categoryId)) {
      uniqueCategories.set(link.categoryId, {
        id: link.category.id,
        name: link.category.name,
        slug: link.category.slug,
        isIncluded: link.isIncluded,
      });
    }
  }

  const categoriesIncluded = features.categoriesIncluded ?? (plan?.isFree === false ? 3 : 1);
  const segmentsIncluded = features.segmentsIncluded ?? categoriesIncluded;
  const allowExtra = Boolean(features.allowExtraCategoriesFree);

  return {
    planName: plan?.name ?? "Fornecedor Free",
    planSlug: plan?.slug ?? "fornecedor-free",
    isFree: plan?.isFree ?? true,
    monthlyQuota: limit,
    categoriesIncluded: allowExtra ? Math.max(categoriesIncluded, 99) : categoriesIncluded,
    segmentsIncluded: allowExtra ? Math.max(segmentsIncluded, 99) : segmentsIncluded,
    allowExtraCategoriesFree: allowExtra,
    categoryIds: [...uniqueCategories.keys()],
    segmentIds: links.map((l) => l.serviceItemId).filter((id): id is string => Boolean(id)),
    categories: [...uniqueCategories.values()],
    links: links.map((link) => ({
      id: link.id,
      categoryId: link.categoryId,
      categoryName: link.category.name,
      serviceItemId: link.serviceItemId,
      segmentName: link.serviceItem?.name ?? null,
      contactName: link.contactName,
      contactEmail: link.contactEmail,
      contactPhone: link.contactPhone,
      isIncluded: link.isIncluded,
    })),
    franchise,
    priceCents: plan?.priceCents ?? 0,
  };
}

export async function assertSupplierCanAccessCategory(
  organizationId: string,
  categoryId: string,
  serviceItemId?: string,
): Promise<void> {
  const links = await firestoreDb.organizationCategory.findMany({
    where: { organizationId, categoryId },
  });
  if (links.length === 0) {
    throw new Error("CATEGORY_NOT_IN_PLAN");
  }
  if (serviceItemId) {
    const match = links.some(
      (link) => link.serviceItemId === serviceItemId || link.serviceItemId == null,
    );
    if (!match) throw new Error("SEGMENT_NOT_IN_PLAN");
  }
}

export async function assertSupplierCanChat(organizationId: string): Promise<void> {
  const gate = await getPlanGate(organizationId);
  if (!gate || gate.isFree) {
    throw new Error("CHAT_REQUIRES_PAID_PLAN");
  }
}

export async function consumeSupplierFranchiseInTx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  organizationId: string,
): Promise<void> {
  const yearMonth = currentYearMonth();
  const [settings, override, subscription, usage] = await Promise.all([
    tx.platformSettings.findUnique({ where: { id: "default" } }),
    tx.planOverride.findUnique({ where: { organizationId } }),
    tx.subscription.findFirst({
      where: { organizationId, status: "active" },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    tx.franchiseUsage.findUnique({
      where: { organizationId_yearMonth: { organizationId, yearMonth } },
    }),
  ]);

  const limit = resolveLimit({
    hasOverride: Boolean(override),
    overrideQuota: override?.monthlyQuota,
    planQuota: subscription ? subscription.plan.monthlyQuota : undefined,
    globalFreeQuota: settings?.freeQuotaFornecedor,
  });

  const used = usage?.usedCount ?? 0;
  if (limit !== null && used >= limit) {
    throw new Error("SUPPLIER_FRANCHISE_EXHAUSTED");
  }

  await tx.franchiseUsage.upsert({
    where: { organizationId_yearMonth: { organizationId, yearMonth } },
    create: { organizationId, yearMonth, usedCount: 1 },
    update: { usedCount: { increment: 1 } },
  });
}
