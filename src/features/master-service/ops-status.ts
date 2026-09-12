import { RIF_MIN_PROPOSALS } from "@/features/master-service/rif";

export type ServiceOpsAttention = "precisa_rif" | "precisa_aceite" | "pronta_fechar" | "fechada" | "aguardar";

export type ServiceOpsSnapshot = {
  proposalCount: number;
  hasMasterAccept: boolean;
  hasPublishedRif: boolean;
  hasDraftRif: boolean;
  rifVisibleToClient: boolean;
  contactReleased: boolean;
  isApproved: boolean;
  isRejected: boolean;
  attention: ServiceOpsAttention;
  nextStep: string;
  rifLabel: string;
};

type QuotationLike = {
  masterAcceptedAt?: Date | string | null;
  contactReleasedAt?: Date | string | null;
  rifVisibleToClient?: boolean | null;
  servicePipelineStatus?: string | null;
  proposals?: unknown[] | null;
  rifAnalyses?: Array<{ status?: string | null }> | null;
};

export function getServiceOpsSnapshot(quotation: QuotationLike): ServiceOpsSnapshot {
  const proposalCount = quotation.proposals?.length ?? 0;
  const hasMasterAccept = Boolean(quotation.masterAcceptedAt);
  const hasPublishedRif = (quotation.rifAnalyses ?? []).some((r) => r.status === "published");
  const hasDraftRif = (quotation.rifAnalyses ?? []).some((r) => r.status === "draft");
  const rifVisibleToClient = Boolean(quotation.rifVisibleToClient);
  const contactReleased = Boolean(quotation.contactReleasedAt);
  const isApproved = quotation.servicePipelineStatus === "aprovada";
  const isRejected = quotation.servicePipelineStatus === "recusada";

  let attention: ServiceOpsAttention = "aguardar";
  let nextStep = "Acompanhar propostas e pipeline.";

  if (isRejected) {
    attention = "fechada";
    nextStep = "Cotação recusada — sem ação pendente.";
  } else if (isApproved || contactReleased) {
    attention = "fechada";
    nextStep = "Fluxo encerrado — contato liberado.";
  } else if (proposalCount < RIF_MIN_PROPOSALS) {
    attention = "aguardar";
    nextStep = `Aguardar propostas (${proposalCount}/${RIF_MIN_PROPOSALS}) ou Disparar convites.`;
  } else if (!hasPublishedRif) {
    attention = "precisa_rif";
    nextStep = hasDraftRif
      ? "Publicar RIF (ou gerar novo marcado como publicar)."
      : "Gerar Análise RIF (≥2 propostas).";
  } else if (!hasMasterAccept) {
    attention = "precisa_aceite";
    nextStep = "Indicar proposta com Aceite Master.";
  } else {
    attention = "pronta_fechar";
    nextStep = "Aguardar aprovador externo ou Confirmar aceite do solicitante.";
  }

  const rifLabel = hasPublishedRif
    ? "RIF publicado"
    : hasDraftRif
      ? "RIF rascunho"
      : "Sem RIF";

  return {
    proposalCount,
    hasMasterAccept,
    hasPublishedRif,
    hasDraftRif,
    rifVisibleToClient,
    contactReleased,
    isApproved,
    isRejected,
    attention,
    nextStep,
    rifLabel,
  };
}

export const ATTENTION_LABELS: Record<ServiceOpsAttention, string> = {
  precisa_rif: "Precisa RIF",
  precisa_aceite: "Precisa Aceite Master",
  pronta_fechar: "Pronta p/ fechar",
  fechada: "Fechada",
  aguardar: "Aguardando propostas",
};

export function isAttentionFilter(value: string): value is ServiceOpsAttention {
  return value in ATTENTION_LABELS;
}
