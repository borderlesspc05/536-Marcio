import { firestoreDb } from "@/lib/firebase/firestore-db";
import { currentYearMonth } from "@/features/quotations/franchise";
import { writeAuditLog } from "@/lib/audit";
import { emitDomainEvent } from "@/lib/domain-events";

export const DISTRIBUTION_TIERS = {
  favorite: 1,
  payingCompliant: 2,
  payingPending: 3,
  freeFallback: 4,
} as const;

export type DistributionResult = {
  invited: Array<{ supplierOrgId: string; tier: number; reason: string }>;
  skipped: Array<{ supplierOrgId: string; reason: string }>;
  paused: boolean;
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function isDistributionEnabled(): boolean {
  return process.env.DISTRIBUTION_ENGINE_ENABLED !== "false";
}

/**
 * Motor de distribuição (Dia 4).
 * Prioridade: Favoritos → Pagantes compliant → Pagantes pendentes → Free fallback.
 * Sem Cloud Functions: chamado de forma síncrona após quotation.created / refill.
 */
export async function runDistributionEngine(quotationId: string): Promise<DistributionResult> {
  const result: DistributionResult = { invited: [], skipped: [], paused: false };

  if (!isDistributionEnabled()) {
    return result;
  }

  const quotation = await firestoreDb.quotation.findUnique({
    where: { id: quotationId },
    include: {
      organization: true,
      invites: true,
    },
  });
  if (!quotation) return result;

  if (
    quotation.invitesPaused ||
    quotation.proposalsCount >= quotation.maxProposals ||
    ["aprovada", "recusada", "cancelada", "encerrada", "finalizada_outros"].includes(
      quotation.status,
    )
  ) {
    result.paused = true;
    return result;
  }

  // Declínios liberam slot: só convites ativos (não declinado/expirado) ocupam capacidade.
  const activeInvites = quotation.invites.filter(
    (invite) => invite.status !== "declinado" && invite.status !== "expirado",
  );
  const existingInviteIds = new Set(quotation.invites.map((invite) => invite.supplierOrgId));
  const slots = Math.max(quotation.maxProposals - activeInvites.length, 0);
  if (slots <= 0) {
    result.paused = true;
    return result;
  }

  const yearMonth = currentYearMonth();
  const suppliers = await firestoreDb.organization.findMany({
    where: { type: "fornecedor" },
    include: {
      subscriptions: {
        where: { status: "active" },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      categories: true,
      complianceDocuments: {
        where: { status: { in: ["aprovado", "em_analise", "em_atraso", "negada"] } },
        orderBy: { createdAt: "desc" },
      },
      franchiseUsages: { where: { yearMonth } },
      favoritedBy: {
        where: { organizationId: quotation.organizationId },
      },
    },
  });

  type Candidate = {
    supplierOrgId: string;
    tier: number;
    reason: string;
  };

  const favorites: Candidate[] = [];
  const payingCompliant: Candidate[] = [];
  const payingPending: Candidate[] = [];
  const freeFallback: Candidate[] = [];

  for (const supplier of suppliers) {
    if (existingInviteIds.has(supplier.id)) {
      result.skipped.push({ supplierOrgId: supplier.id, reason: "Já convidado" });
      continue;
    }

    const hasSegmentMatch = supplier.categories.some((link) => {
      if (link.categoryId !== quotation.categoryId) return false;
      // Match exato de segmento; legado sem serviceItemId ainda casa na categoria
      if (!link.serviceItemId) return true;
      return link.serviceItemId === quotation.serviceItemId;
    });
    if (!hasSegmentMatch) {
      result.skipped.push({
        supplierOrgId: supplier.id,
        reason: "Categoria/segmento não contratado no pacote",
      });
      continue;
    }

    const plan = supplier.subscriptions[0]?.plan;
    const isFree = plan?.isFree ?? true;
    const monthlyQuota = plan?.monthlyQuota ?? 1;
    const used = supplier.franchiseUsages[0]?.usedCount ?? 0;
    const hasBalance = monthlyQuota === null || used < monthlyQuota;

    if (!hasBalance) {
      result.skipped.push({
        supplierOrgId: supplier.id,
        reason: "Sem saldo de cotação interna no mês",
      });
      continue;
    }

    const docs = supplier.complianceDocuments;
    const hasApproved = docs.some((doc) => doc.status === "aprovado");
    const hasOverdueOrDenied = docs.some((doc) =>
      ["em_atraso", "negada"].includes(doc.status),
    );
    const isCompliant = hasApproved && !hasOverdueOrDenied;

    const matchingFavorite = supplier.favoritedBy.find(
      (fav) => !fav.categoryId || fav.categoryId === quotation.categoryId,
    );
    const isFavorite =
      quotation.organization.type === "administradora" && Boolean(matchingFavorite);

    if (isFavorite && !isFree) {
      favorites.push({
        supplierOrgId: supplier.id,
        tier: DISTRIBUTION_TIERS.favorite,
        reason: matchingFavorite?.categoryId
          ? "Favorito da administradora na categoria + plano pago + saldo"
          : "Favorito da administradora + plano pago + saldo",
      });
      continue;
    }

    if (!isFree && isCompliant) {
      payingCompliant.push({
        supplierOrgId: supplier.id,
        tier: DISTRIBUTION_TIERS.payingCompliant,
        reason: "Pagante compliant (docs aprovados)",
      });
      continue;
    }

    if (!isFree) {
      payingPending.push({
        supplierOrgId: supplier.id,
        tier: DISTRIBUTION_TIERS.payingPending,
        reason: "Pagante com pendência documental",
      });
      continue;
    }

    freeFallback.push({
      supplierOrgId: supplier.id,
      tier: DISTRIBUTION_TIERS.freeFallback,
      reason: "Fallback Free (categoria + saldo 1/mês)",
    });
  }

  const ordered = [
    ...favorites,
    ...shuffle(payingCompliant),
    ...shuffle(payingPending),
    ...shuffle(freeFallback),
  ].slice(0, slots);

  for (const candidate of ordered) {
    await firestoreDb.quotationInvite.create({
      data: {
        quotationId: quotation.id,
        supplierOrgId: candidate.supplierOrgId,
        status: "pendente",
        priorityTier: candidate.tier,
        selectionReason: candidate.reason,
      },
    });
    result.invited.push(candidate);

    await writeAuditLog({
      action: "distribution.invite_created",
      entityType: "quotation",
      entityId: quotation.id,
      metadata: {
        supplierOrgId: candidate.supplierOrgId,
        tier: candidate.tier,
        reason: candidate.reason,
      },
    });
  }

  for (const skipped of [...payingCompliant, ...payingPending, ...freeFallback, ...favorites]) {
    if (result.invited.some((item) => item.supplierOrgId === skipped.supplierOrgId)) continue;
    if (result.skipped.some((item) => item.supplierOrgId === skipped.supplierOrgId)) continue;
    if (ordered.length >= slots) {
      result.skipped.push({
        supplierOrgId: skipped.supplierOrgId,
        reason: `Capacidade de convites atingida (tier ${skipped.tier})`,
      });
    }
  }

  await emitDomainEvent({
    type: "distribution.completed",
    entityType: "quotation",
    entityId: quotation.id,
    organizationId: quotation.organizationId,
    payload: {
      invited: result.invited.length,
      skipped: result.skipped.length,
    },
  });

  return result;
}

export async function pauseQuotationInvitesIfMaxReached(quotationId: string): Promise<boolean> {
  const quotation = await firestoreDb.quotation.findUnique({ where: { id: quotationId } });
  if (!quotation) return false;
  if (quotation.proposalsCount < quotation.maxProposals) return false;

  await firestoreDb.quotation.update({
    where: { id: quotationId },
    data: { invitesPaused: true },
  });

  await emitDomainEvent({
    type: "quotation.max_proposals_reached",
    entityType: "quotation",
    entityId: quotationId,
    organizationId: quotation.organizationId,
    payload: {
      proposalsCount: quotation.proposalsCount,
      maxProposals: quotation.maxProposals,
    },
  });

  return true;
}

export async function emitMinProposalsIfReached(quotationId: string): Promise<boolean> {
  const quotation = await firestoreDb.quotation.findUnique({ where: { id: quotationId } });
  if (!quotation) return false;
  if (quotation.proposalsCount < quotation.minProposals) return false;

  const already = await firestoreDb.domainEvent.findFirst({
    where: { entityId: quotationId, type: "quotation.min_proposals_reached" },
  });
  if (already) return false;

  await emitDomainEvent({
    type: "quotation.min_proposals_reached",
    entityType: "quotation",
    entityId: quotationId,
    organizationId: quotation.organizationId,
    payload: {
      proposalsCount: quotation.proposalsCount,
      minProposals: quotation.minProposals,
      quotationId,
      code: quotation.publicId,
    },
  });

  return true;
}
