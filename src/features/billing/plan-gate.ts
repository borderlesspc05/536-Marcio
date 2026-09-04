import { cache } from "react";
import type { OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { getPlanSlugsForOrganization } from "@/features/billing/plan-catalog";

export type PlanFeatureKey =
  | "whitelabel"
  | "favorites"
  | "partnerships"
  | "commissions"
  | "sla"
  | "crm"
  | "partnershipEligible"
  | "cotaService"
  | "rif"
  | "managedQuotation"
  | "vip";

export type PlanFeatures = Partial<Record<PlanFeatureKey, boolean>> & {
  categoriesIncluded?: number;
  segmentsIncluded?: number;
  allowExtraCategoriesFree?: boolean;
};

export type PlanGateContext = {
  organizationId: string;
  planSlug: string;
  planName: string;
  isFree: boolean;
  monthlyQuota: number | null;
  priceCents: number;
  features: PlanFeatures;
  overrideFeatures: PlanFeatures;
  subscriptionStatus: string;
};

export function parsePlanFeatures(json: string | null | undefined): PlanFeatures {
  try {
    return JSON.parse(json || "{}") as PlanFeatures;
  } catch {
    return {};
  }
}

export const getPlanGate = cache(async (organizationId: string): Promise<PlanGateContext | null> => {
  const [activeSubscription, pendingSubscription, override] = await Promise.all([
    firestoreDb.subscription.findFirst({
      where: { organizationId, status: { in: ["active", "past_due"] } },
      include: { plan: true, pendingPlan: true },
      orderBy: { createdAt: "desc" },
    }),
    firestoreDb.subscription.findFirst({
      where: { organizationId, status: "pending" },
      include: { plan: true, pendingPlan: true },
      orderBy: { createdAt: "desc" },
    }),
    firestoreDb.planOverride.findUnique({ where: { organizationId } }),
  ]);

  const subscription = activeSubscription ?? pendingSubscription;
  if (!subscription) return null;

  const planFeatures = parsePlanFeatures(subscription.plan.featuresJson);
  const overrideFeatures = parsePlanFeatures(override?.featuresJson);

  return {
    organizationId,
    planSlug: subscription.plan.slug,
    planName: subscription.plan.name,
    isFree: subscription.plan.isFree,
    monthlyQuota: override?.monthlyQuota ?? subscription.plan.monthlyQuota,
    priceCents: subscription.plan.priceCents,
    features: { ...planFeatures, ...overrideFeatures },
    overrideFeatures,
    subscriptionStatus: subscription.status,
  };
});

export function can(gate: PlanGateContext | null, feature: PlanFeatureKey): boolean {
  if (!gate) return false;
  // past_due mantém acesso durante o período de regularização.
  if (!["active", "past_due"].includes(gate.subscriptionStatus)) return false;
  return Boolean(gate.features[feature]);
}

export function getQuota(gate: PlanGateContext | null): number | null {
  if (!gate) return 0;
  return gate.monthlyQuota;
}

export function getCategoriesIncluded(gate: PlanGateContext | null): number {
  if (!gate) return 1;
  return gate.features.categoriesIncluded ?? (gate.isFree ? 1 : 3);
}

export async function listActivePlans(audience?: "solicitante" | "fornecedor") {
  return firestoreDb.plan.findMany({
    where: {
      isActive: true,
      ...(audience ? { audience } : { audience: { in: ["solicitante", "fornecedor"] } }),
    },
    orderBy: [{ audience: "asc" }, { sortOrder: "asc" }, { priceCents: "asc" }],
  });
}

export async function listActivePlansForOrganization(organizationType: OrganizationType) {
  const slugs = getPlanSlugsForOrganization(organizationType);
  if (slugs.length === 0) return [];
  return firestoreDb.plan.findMany({
    where: { isActive: true, slug: { in: [...slugs] } },
    orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }],
  });
}

export { formatPriceCents } from "@/features/billing/money";
