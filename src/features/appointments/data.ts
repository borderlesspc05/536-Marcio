import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { getExternalApproverCondominiumIds } from "@/features/external-approver/guards";
import { resolveDateRange, type AppointmentFilterInput } from "@/features/appointments/filters";

export async function listAccessibleCondominiums(input: {
  userId: string;
  organizationId: string;
  organizationType: OrganizationType;
  role: MemberRole;
  serviceClientId?: string;
}) {
  if (input.role === MemberRole.external_approver) {
    const ids = await getExternalApproverCondominiumIds(input.userId, input.organizationId);
    return firestoreDb.condominium.findMany({
      where: { id: { in: ids }, archivedAt: null },
      orderBy: { name: "asc" },
    });
  }

  if (input.organizationType === OrganizationType.master_service) {
    const clients = await firestoreDb.serviceClient.findMany({
      where: { managedByOrgId: input.organizationId, isActive: true },
      select: { clientOrgId: true },
    });
    const orgIds = clients.map((client) => client.clientOrgId);
    return firestoreDb.condominium.findMany({
      where: {
        organizationId: { in: orgIds },
        archivedAt: null,
        ...(input.serviceClientId
          ? { organization: { serviceClientProfile: { id: input.serviceClientId } } }
          : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  return firestoreDb.condominium.findMany({
    where: {
      organizationId: input.organizationId,
      archivedAt: null,
    },
    orderBy: { name: "asc" },
  });
}

export async function listAppointments(input: {
  userId: string;
  organizationId: string;
  organizationType: OrganizationType;
  role: MemberRole;
  filters: AppointmentFilterInput;
  serviceClientId?: string;
}) {
  const condominiums = await listAccessibleCondominiums(input);
  const condominiumIds = input.filters.condominiumId
    ? condominiums.filter((c) => c.id === input.filters.condominiumId).map((c) => c.id)
    : condominiums.map((c) => c.id);

  if (condominiumIds.length === 0) return [];

  const { from, to } = resolveDateRange(input.filters);

  let organizationFilter: { organizationId?: string | { in: string[] } } = {};
  if (input.organizationType === OrganizationType.master_service) {
    const clients = await firestoreDb.serviceClient.findMany({
      where: { managedByOrgId: input.organizationId, isActive: true },
      select: { clientOrgId: true },
    });
    organizationFilter = { organizationId: { in: clients.map((c) => c.clientOrgId) } };
  } else if (input.role !== MemberRole.external_approver) {
    organizationFilter = { organizationId: input.organizationId };
  }

  return firestoreDb.serviceAppointment.findMany({
    where: {
      ...organizationFilter,
      condominiumId: { in: condominiumIds },
      ...(input.filters.categoryId ? { categoryId: input.filters.categoryId } : {}),
      ...(input.serviceClientId ? { serviceClientId: input.serviceClientId } : {}),
      ...(from || to
        ? {
            appointmentDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    include: {
      condominium: true,
      category: true,
      serviceItem: true,
      serviceClient: true,
      externalApproval: {
        include: {
          approvedBy: true,
          proposal: {
            include: { organization: true, conditions: true },
          },
        },
      },
      quotation: {
        include: {
          externalApproval: true,
        },
      },
    },
    orderBy: { appointmentDate: "asc" },
  });
}

export async function getAppointmentDetail(id: string) {
  return firestoreDb.serviceAppointment.findUnique({
    where: { id },
    include: {
      condominium: true,
      category: true,
      serviceItem: true,
      serviceClient: true,
      externalApproval: {
        include: {
          approvedBy: true,
          proposal: {
            include: {
              organization: true,
              conditions: true,
            },
          },
          quotation: true,
        },
      },
      quotation: {
        include: {
          externalApproval: true,
          proposals: {
            include: { organization: true, conditions: true },
          },
        },
      },
    },
  });
}
