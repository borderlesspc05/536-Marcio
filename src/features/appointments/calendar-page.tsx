import { Suspense } from "react";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { listAppointments, listAccessibleCondominiums } from "@/features/appointments/data";
import { AppointmentCreateForm } from "@/features/appointments/components/AppointmentCreateForm";
import { AppointmentFiltersBar } from "@/features/appointments/components/AppointmentFiltersBar";
import { AppointmentListPanel } from "@/features/appointments/components/AppointmentListPanel";
import type { AppointmentFilterInput, DateRangePreset } from "@/features/appointments/filters";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
  basePath: string;
  title: string;
  subtitle: string;
  serviceClientId?: string;
  allowCreate?: boolean;
};

function parseFilters(params: Record<string, string | undefined>): AppointmentFilterInput {
  return {
    condominiumId: params.condominiumId,
    categoryId: params.categoryId,
    preset: params.preset as DateRangePreset | undefined,
    dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
    dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
  };
}

export async function renderCalendarPage({
  searchParams,
  basePath,
  title,
  subtitle,
  serviceClientId,
  allowCreate = true,
}: PageProps) {
  const session = await requireAuthorizedSession();
  const params = await searchParams;
  const filters = parseFilters(params);

  const [condominiums, categories, serviceItems, appointments] = await Promise.all([
    listAccessibleCondominiums({
      userId: session.userId,
      organizationId: session.organizationId,
      organizationType: session.organizationType,
      role: session.role,
      serviceClientId,
    }),
    firestoreDb.serviceCategory.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: "asc" },
    }),
    firestoreDb.serviceItem.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, categoryId: true },
    }),
    listAppointments({
      userId: session.userId,
      organizationId: session.organizationId,
      organizationType: session.organizationType,
      role: session.role,
      filters,
      serviceClientId,
    }),
  ]);

  const canManage = true;

  const toIso = (value: unknown) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    return new Date().toISOString();
  };

  const serialized = appointments.map((row) => ({
    id: row.id,
    appointmentDate: toIso(row.appointmentDate),
    leadMode: row.leadMode,
    source: row.source,
    notes: row.notes ?? null,
    condominium: row.condominium ?? { name: "—" },
    category: row.category ?? { name: "—" },
    serviceItem: row.serviceItem,
    externalApproval: row.externalApproval
      ? {
          reason: row.externalApproval.reason ?? "",
          approvedAt: toIso(
            row.externalApproval.approvedAt ?? row.externalApproval.createdAt,
          ),
          approvedBy: row.externalApproval.approvedBy ?? { name: "Aprovador" },
          proposal: row.externalApproval.proposal ?? null,
        }
      : null,
  }));

  const now = Date.now();
  const upcoming = [...serialized]
    .filter((row) => new Date(row.appointmentDate).getTime() >= now - 12 * 60 * 60 * 1000)
    .sort(
      (a, b) =>
        new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime(),
    )
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Calendário</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">{title}</h1>
        <p className="mt-2 text-neutral-600">{subtitle}</p>
      </div>

      <Suspense fallback={null}>
        <AppointmentFiltersBar
          condominiums={condominiums}
          categories={categories}
          basePath={basePath}
        />
      </Suspense>

      <AppointmentListPanel
        appointments={serialized}
        upcoming={upcoming}
        canManage={canManage}
      />

      {allowCreate && canManage ? (
        <AppointmentCreateForm
          condominiums={condominiums}
          categories={categories}
          serviceItems={serviceItems}
        />
      ) : null}
    </div>
  );
}
