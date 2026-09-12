import { firestoreDb } from "@/lib/firebase/firestore-db";
import type { ServicePipelineStatus } from "@/lib/domain/types";
import { getExternalApproverCondominiumIds } from "@/features/external-approver/guards";

export type ExternalQuotationTab = "pendentes" | "aprovadas" | "recusadas";

export async function listExternalApproverQuotations(input: {
  userId: string;
  organizationId: string;
  tab: ExternalQuotationTab;
}) {
  const condominiumIds = await getExternalApproverCondominiumIds(
    input.userId,
    input.organizationId,
  );
  if (condominiumIds.length === 0) return [];

  const baseWhere = {
    organizationId: input.organizationId,
    condominiumId: { in: condominiumIds },
    serviceClientId: { not: null },
    masterAcceptedAt: { not: null },
    rifVisibleToClient: true,
  };

  const where =
    input.tab === "pendentes"
      ? {
          ...baseWhere,
          externalApproval: { is: null },
          servicePipelineStatus: {
            in: ["em_analise", "em_negociacao"] as ServicePipelineStatus[],
          },
        }
      : input.tab === "aprovadas"
        ? {
            ...baseWhere,
            // rejected pode estar ausente em registros antigos — aceita qualquer não-recusado
            externalApproval: { rejected: { not: true } },
            servicePipelineStatus: "aprovada" as ServicePipelineStatus,
          }
        : {
            ...baseWhere,
            OR: [
              { servicePipelineStatus: "recusada" as ServicePipelineStatus },
              { externalApproval: { rejected: true } },
            ],
          };

  return firestoreDb.quotation.findMany({
    where,
    include: {
      condominium: true,
      category: true,
      serviceItem: true,
      serviceClient: true,
      externalApproval: true,
      proposals: {
        where: { status: { not: "recusada" } },
        include: {
          organization: true,
          conditions: { orderBy: { sortOrder: "asc" } },
        },
      },
      rifAnalyses: {
        where: { status: "published" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getExternalApproverQuotation(input: {
  userId: string;
  organizationId: string;
  quotationId: string;
}) {
  const condominiumIds = await getExternalApproverCondominiumIds(
    input.userId,
    input.organizationId,
  );
  if (condominiumIds.length === 0) return null;

  return firestoreDb.quotation.findFirst({
    where: {
      id: input.quotationId,
      organizationId: input.organizationId,
      condominiumId: { in: condominiumIds },
      serviceClientId: { not: null },
      masterAcceptedAt: { not: null },
      rifVisibleToClient: true,
    },
    include: {
      condominium: true,
      category: true,
      serviceItem: true,
      serviceClient: true,
      organization: true,
      externalApproval: true,
      proposals: {
        include: {
          organization: true,
          conditions: { orderBy: { sortOrder: "asc" } },
        },
      },
      rifAnalyses: {
        where: { status: "published" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function getServiceClientBySlug(slug: string) {
  return firestoreDb.serviceClient.findFirst({
    where: { solicitationLinkSlug: slug, solicitationLinkActive: true, isActive: true },
    include: {
      clientOrg: true,
      managedBy: true,
    },
  });
}
