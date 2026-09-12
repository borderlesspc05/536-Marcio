import { ServicePipelineStatus } from "@/lib/domain/types";

/** Cotação visível/acionável para o fornecedor alinhada ao status do solicitante. */
export function isQuotationVisibleToSupplier(quotation: {
  status: string;
  servicePipelineStatus?: string | null;
}): boolean {
  const closed = new Set([
    "aprovada",
    "finalizada_outros",
    "encerrada",
    "recusada",
    "cancelada",
  ]);
  if (closed.has(quotation.status)) return true;

  if (!["aberta", "em_negociacao"].includes(quotation.status)) {
    return false;
  }

  // Cota Service ainda não liberada pelo Master — não aparece como oportunidade nova
  if (quotation.servicePipelineStatus === ServicePipelineStatus.em_liberacao) {
    return false;
  }

  return true;
}

/** Rótulo alinhado ao status do solicitante / pipeline service. */
export function supplierFacingQuotationLabel(quotation: {
  status: string;
  servicePipelineStatus?: string | null;
}): string {
  if (quotation.servicePipelineStatus === ServicePipelineStatus.em_analise) {
    return "Aguardando aprovação do solicitante / aprovador";
  }
  if (quotation.servicePipelineStatus === ServicePipelineStatus.em_liberacao) {
    return "Aguardando liberação do Master Service";
  }
  if (quotation.servicePipelineStatus === ServicePipelineStatus.aprovada) {
    return "Aprovada pelo solicitante";
  }
  if (quotation.servicePipelineStatus === ServicePipelineStatus.recusada) {
    return "Recusada pelo solicitante";
  }
  if (quotation.status === "em_negociacao") return "Em negociação";
  if (quotation.status === "aberta") return "Aberta — aguardando propostas";
  if (quotation.status === "aprovada") return "Aprovada";
  if (quotation.status === "finalizada_outros") return "Finalizada — Outros";
  return quotation.status.replace(/_/g, " ");
}
