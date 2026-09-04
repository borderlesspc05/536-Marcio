import type { ServicePipelineStatus } from "@/lib/domain/types";

export const SERVICE_PIPELINE_LABELS: Record<ServicePipelineStatus, string> = {
  em_liberacao: "Em Liberação",
  em_andamento: "Em Andamento",
  em_negociacao: "Em Negociação",
  em_analise: "Em Análise",
  recusada: "Recusadas",
  aprovada: "Aprovadas",
};

export const SERVICE_PIPELINE_ORDER: ServicePipelineStatus[] = [
  "em_liberacao",
  "em_andamento",
  "em_negociacao",
  "em_analise",
  "recusada",
  "aprovada",
];

export function isServicePipelineStatus(value: string): value is ServicePipelineStatus {
  return SERVICE_PIPELINE_ORDER.includes(value as ServicePipelineStatus);
}
