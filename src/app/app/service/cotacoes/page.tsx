import Link from "next/link";
import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { getServicePipelineCounts, listServiceQuotations } from "@/features/master-service/data";
import {
  SERVICE_PIPELINE_LABELS,
  SERVICE_PIPELINE_ORDER,
  isServicePipelineStatus,
} from "@/features/master-service/pipeline";
import { Button } from "@/components/ui/Button";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function ServiceCotacoesPage({ searchParams }: PageProps) {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.master_service],
    href: "/app/service/cotacoes",
  });

  const params = await searchParams;
  const status =
    params.status && isServicePipelineStatus(params.status) ? params.status : undefined;

  const [counts, quotations] = await Promise.all([
    getServicePipelineCounts(session.organizationId),
    listServiceQuotations({
      managedByOrgId: session.organizationId,
      status,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">
            Master Service
          </p>
          <h1 className="mt-1 text-3xl font-bold text-neutral-900">Pipeline de cotações</h1>
          <p className="mt-2 text-neutral-600">
            Liberação, andamento, negociação, análise, recusas e aprovações do Cota Service.
          </p>
        </div>
        <Link href="/app/service/clientes">
          <Button variant="secondary">Clientes</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/app/service/cotacoes"
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            !status ? "bg-[#9333EA] text-white" : "bg-neutral-100 text-neutral-700"
          }`}
        >
          Todas
        </Link>
        {SERVICE_PIPELINE_ORDER.map((key) => (
          <Link
            key={key}
            href={`/app/service/cotacoes?status=${key}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              status === key ? "bg-[#9333EA] text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {SERVICE_PIPELINE_LABELS[key]} ({counts[key]})
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/80">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Condomínio</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Solicitante</th>
              <th className="px-4 py-3 font-medium">Pipeline</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                  Nenhuma cotação neste filtro.
                </td>
              </tr>
            ) : (
              quotations.map((item) => (
                <tr key={item.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3 font-medium">{item.publicId}</td>
                  <td className="px-4 py-3">
                    {item.serviceClient?.displayName ?? item.organization.name}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{item.condominium.name}</td>
                  <td className="px-4 py-3 text-neutral-600">{item.category.name}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {item.requesterName ?? "—"}
                    {item.requesterEmail ? (
                      <span className="block text-xs text-neutral-400">{item.requesterEmail}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {item.servicePipelineStatus
                      ? SERVICE_PIPELINE_LABELS[item.servicePipelineStatus]
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/app/service/cotacoes/${item.id}`}
                      className="font-semibold text-[#9333EA]"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
