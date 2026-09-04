import { firestoreDb } from "@/lib/firebase/firestore-db";
import { getFranchiseBalance } from "@/features/quotations/franchise";
import { getSupplierFranchiseBalance } from "@/features/supplier/franchise";
import type { OrganizationType } from "@/lib/domain/types";

export type DashboardKpis = {
  openQuotations: number;
  inNegotiation: number;
  proposalsReceived: number;
  approved: number;
  rejected: number;
  franchiseRemaining: number | null;
  franchiseLimit: number | null;
  franchiseUsed: number;
  isUnlimited: boolean;
  canCreateQuotation: boolean;
  partnershipRevenueCents?: number;
};

export type SupplierDashboardKpis = {
  pendingOpportunities: number;
  proposalsSent: number;
  approved: number;
  rejected: number;
  inNegotiation: number;
  overdueDocuments: number;
  closedVolumeCents: number;
  rejectedVolumeCents: number;
  franchiseRemaining: number | null;
  franchiseLimit: number | null;
  franchiseUsed: number;
  isUnlimited: boolean;
  canSubmitProposal: boolean;
};

export async function getDashboardKpis(input: {
  organizationId: string;
  organizationType: OrganizationType;
}): Promise<DashboardKpis> {
  const franchise = await getFranchiseBalance(input.organizationId);

  const [openQuotations, inNegotiation, approved, rejected, proposalsReceived] =
    await Promise.all([
      firestoreDb.quotation.count({
        where: { organizationId: input.organizationId, status: "aberta" },
      }),
      firestoreDb.quotation.count({
        where: { organizationId: input.organizationId, status: "em_negociacao" },
      }),
      firestoreDb.quotation.count({
        where: { organizationId: input.organizationId, status: "aprovada" },
      }),
      firestoreDb.quotation.count({
        where: {
          organizationId: input.organizationId,
          status: { in: ["recusada", "finalizada_outros"] },
        },
      }),
      firestoreDb.proposal.count({
        where: { quotation: { organizationId: input.organizationId } },
      }),
    ]);

  let partnershipRevenueCents: number | undefined;
  if (input.organizationType === "administradora") {
    const agg = await firestoreDb.commissionEntry.aggregate({
      where: { administradoraOrgId: input.organizationId, status: { in: ["expected", "accrued", "paid"] } },
      _sum: { commissionCents: true },
    });
    partnershipRevenueCents = agg._sum.commissionCents ?? 0;
  }

  return {
    openQuotations,
    inNegotiation,
    proposalsReceived,
    approved,
    rejected,
    franchiseRemaining: franchise.remaining,
    franchiseLimit: franchise.limit,
    franchiseUsed: franchise.used,
    isUnlimited: franchise.isUnlimited,
    canCreateQuotation: franchise.canCreate,
    partnershipRevenueCents,
  };
}

export async function getSupplierDashboardKpis(
  organizationId: string,
): Promise<SupplierDashboardKpis> {
  const franchise = await getSupplierFranchiseBalance(organizationId);

  const [
    pendingOpportunities,
    proposalsSent,
    approved,
    rejected,
    inNegotiation,
    overdueDocuments,
    approvedProposals,
    rejectedProposals,
  ] = await Promise.all([
    firestoreDb.quotationInvite.count({
      where: { supplierOrgId: organizationId, status: "pendente" },
    }),
    firestoreDb.proposal.count({
      where: { organizationId, status: "enviada" },
    }),
    firestoreDb.proposal.count({
      where: { organizationId, status: "aprovada" },
    }),
    firestoreDb.proposal.count({
      where: { organizationId, status: "recusada" },
    }),
    firestoreDb.proposal.count({
      where: { organizationId, status: "em_negociacao" },
    }),
    firestoreDb.complianceDocument.count({
      where: { organizationId, status: "em_atraso" },
    }),
    firestoreDb.proposal.findMany({
      where: { organizationId, status: "aprovada" },
      include: { conditions: { orderBy: { amountCents: "asc" }, take: 1 } },
    }),
    firestoreDb.proposal.findMany({
      where: { organizationId, status: "recusada" },
      include: { conditions: { orderBy: { amountCents: "asc" }, take: 1 } },
    }),
  ]);

  const closedVolumeCents = approvedProposals.reduce(
    (sum, item) => sum + (item.conditions[0]?.amountCents ?? 0),
    0,
  );
  const rejectedVolumeCents = rejectedProposals.reduce(
    (sum, item) => sum + (item.conditions[0]?.amountCents ?? 0),
    0,
  );

  return {
    pendingOpportunities,
    proposalsSent,
    approved,
    rejected,
    inNegotiation,
    overdueDocuments,
    closedVolumeCents,
    rejectedVolumeCents,
    franchiseRemaining: franchise.remaining,
    franchiseLimit: franchise.limit,
    franchiseUsed: franchise.used,
    isUnlimited: franchise.isUnlimited,
    canSubmitProposal: franchise.canSubmitProposal,
  };
}
