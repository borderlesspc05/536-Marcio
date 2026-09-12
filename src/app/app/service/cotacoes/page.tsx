import Link from "next/link";
import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import {
  getServicePipelineCounts,
  listServiceClients,
  listServiceQuotations,
} from "@/features/master-service/data";
import {
  SERVICE_PIPELINE_LABELS,
  SERVICE_PIPELINE_ORDER,
  isServicePipelineStatus,
} from "@/features/master-service/pipeline";
import {
  ATTENTION_LABELS,
  getServiceOpsSnapshot,
  isAttentionFilter,
  type ServiceOpsAttention,
} from "@/features/master-service/ops-status";
import { ServiceOpsChips } from "@/features/master-service/components/ServiceOpsBadges";
import { Button } from "@/components/ui/Button";

type PageProps = {
  searchParams: Promise<{ status?: string; attention?: string; client?: string }>;
};

const ATTENTION_FILTERS: ServiceOpsAttention[] = [
  "precisa_rif",
  "precisa_aceite",
  "pronta_fechar",
];

function qs(parts: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parts)) {
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export default async function ServiceCotacoesPage({ searchParams }: PageProps) {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.master_service],
    href: "/app/service/cotacoes",
  });

  const params = await searchParams;
  const status =
    params.status && isServicePipelineStatus(params.status) ? params.status : undefined;
  const attention =
    params.attention && isAttentionFilter(params.attention) ? params.attention : undefined;
  const clientId = params.client?.trim() || undefined;

  const [counts, quotations, clients] = await Promise.all([
    getServicePipelineCounts(session.organizationId),
    listServiceQuotations({
      managedByOrgId: session.organizationId,
      status,
      serviceClientId: clientId,
    }),
    listServiceClients(session.organizationId),
  ]);

  const withOps = quotations.map((item) => ({
    item,
    ops: getServiceOpsSnapshot(item),
  }));

  const attentionCounts = Object.fromEntries(
    ATTENTION_FILTERS.map((key) => [
      key,
      withOps.filter((row) => row.ops.attention === key).length,
    ]),
  ) as Record<(typeof ATTENTION_FILTERS)[number], number>;

  const filtered = attention
    ? withOps.filter((row) => row.ops.attention === attention)
    : withOps;

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#c10089]">
            Master Service
          </p>
          <h1 className="mt-1 text-3xl font-bold text-neutral-900">Pipeline de cotações</h1>
          <p className="mt-2 text-neutral-600">
            Cotações por status para tratativa, com filtro por cliente da carteira.
          </p>
        </div>
        <Link href="/app/service/clientes">
          <Button variant="secondary">Clientes</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/5 bg-white/80 p-4">
        <form method="get" className="flex flex-wrap items-center gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {attention ? <input type="hidden" name="attention" value={attention} /> : null}
          <label className="text-sm font-semibold text-neutral-700">
            Cliente
            <select
              name="client"
              defaultValue={clientId ?? ""}
              className="ml-2 h-10 min-w-[220px] rounded-xl border border-black/10 px-3 text-sm font-normal"
            >
              <option value="">Todos os clientes</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.displayName}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="sm" variant="secondary">
            Filtrar
          </Button>
          {clientId ? (
            <Link
              href={`/app/service/cotacoes${qs({ status, attention })}`}
              className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold text-[#c10089]"
            >
              Limpar cliente
            </Link>
          ) : null}
        </form>
        {selectedClient ? (
          <p className="w-full text-xs text-neutral-500">
            Exibindo carteira: <strong>{selectedClient.displayName}</strong>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/app/service/cotacoes${qs({ client: clientId })}`}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            !status && !attention ? "bg-[#c10089] text-white" : "bg-neutral-100 text-neutral-700"
          }`}
        >
          Todas
        </Link>
        {SERVICE_PIPELINE_ORDER.map((key) => (
          <Link
            key={key}
            href={`/app/service/cotacoes${qs({ status: key, client: clientId })}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              status === key ? "bg-[#c10089] text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {SERVICE_PIPELINE_LABELS[key]} ({counts[key]})
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Atenção
        </span>
        {ATTENTION_FILTERS.map((key) => (
          <Link
            key={key}
            href={`/app/service/cotacoes${qs({
              attention: key,
              status,
              client: clientId,
            })}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
              attention === key
                ? "bg-[#FFF7FB] text-[#9a006e] ring-[#c10089]/40"
                : "bg-white text-neutral-700 ring-black/10"
            }`}
          >
            {ATTENTION_LABELS[key]} ({attentionCounts[key]})
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/80">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Cliente / condomínio</th>
              <th className="px-4 py-3 font-medium">Operação</th>
              <th className="px-4 py-3 font-medium">Pipeline</th>
              <th className="px-4 py-3 font-medium">Próximo passo</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  Nenhuma cotação neste filtro.
                </td>
              </tr>
            ) : (
              filtered.map(({ item, ops }) => (
                <tr key={item.id} className="border-b border-black/5 last:border-0 align-top">
                  <td className="px-4 py-3 font-medium">{item.publicId}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {item.serviceClient?.displayName ?? item.organization.name}
                    </p>
                    <p className="text-xs text-neutral-500">{item.condominium.name}</p>
                    <p className="text-xs text-neutral-400">
                      {item.category.name}
                      {item.requesterName ? ` · ${item.requesterName}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <ServiceOpsChips ops={ops} compact />
                  </td>
                  <td className="px-4 py-3">
                    {item.servicePipelineStatus
                      ? SERVICE_PIPELINE_LABELS[item.servicePipelineStatus]
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600 max-w-[220px]">{ops.nextStep}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/app/service/cotacoes/${item.id}`}
                      className="font-semibold text-[#c10089]"
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
