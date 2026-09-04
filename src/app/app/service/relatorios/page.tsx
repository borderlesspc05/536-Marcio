import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { getServiceReports } from "@/features/master-service/data";
import { formatPriceCents } from "@/features/billing/money";
import { SERVICE_PIPELINE_LABELS } from "@/features/master-service/pipeline";
import type { ServicePipelineStatus } from "@/lib/domain/types";

export default async function ServiceRelatoriosPage() {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.master_service],
    href: "/app/service/relatorios",
  });

  const reports = await getServiceReports(session.organizationId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">
          Master Service
        </p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Relatórios</h1>
        <p className="mt-2 text-neutral-600">
          BI sob demanda: volumes por status, categoria, cliente e fornecedor.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <p className="text-sm text-neutral-500">Clientes Cota Service</p>
          <p className="mt-2 text-3xl font-bold">{reports.clientsCount}</p>
        </div>
        {reports.byStatus.map((row) => (
          <div key={String(row.servicePipelineStatus)} className="rounded-2xl border border-black/5 bg-white/80 p-5">
            <p className="text-sm text-neutral-500">
              {row.servicePipelineStatus
                ? SERVICE_PIPELINE_LABELS[row.servicePipelineStatus as ServicePipelineStatus]
                : "Sem status"}
            </p>
            <p className="mt-2 text-3xl font-bold">{row._count._all}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <h2 className="font-semibold">Por categoria</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {reports.byCategory.map((row) => (
              <li key={row.categoryId} className="flex justify-between">
                <span>{row.name}</span>
                <span className="font-semibold">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <h2 className="font-semibold">Clientes que mais solicitam</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {reports.topClients.map((row) => (
              <li key={row.organizationId} className="flex justify-between">
                <span>{row.name}</span>
                <span className="font-semibold">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-black/5 bg-white/80 p-5 lg:col-span-2">
          <h2 className="font-semibold">Volume financeiro por fornecedor (aprovados)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {reports.supplierVolume.length === 0 ? (
              <li className="text-neutral-500">Sem aprovações ainda.</li>
            ) : (
              reports.supplierVolume.map((row) => (
                <li key={row.name} className="flex justify-between">
                  <span>
                    {row.name} · {row.count} fechamento(s)
                  </span>
                  <span className="font-semibold">{formatPriceCents(row.cents)}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
