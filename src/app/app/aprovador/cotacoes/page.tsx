import Link from "next/link";
import { requireExternalApprover } from "@/features/external-approver/guards";
import {
  listExternalApproverQuotations,
  type ExternalQuotationTab,
} from "@/features/external-approver/data";
import { formatDateTimePt } from "@/lib/format-date";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

const TABS: Array<{ key: ExternalQuotationTab; label: string; empty: string }> = [
  {
    key: "pendentes",
    label: "Pendentes",
    empty:
      "Nenhuma cotação pendente. Só aparecem após o Master Service fazer Aceite Master e liberar o RIF publicado.",
  },
  {
    key: "aprovadas",
    label: "Aprovadas",
    empty: "Você ainda não aprovou nenhuma cotação nesta conta.",
  },
  {
    key: "recusadas",
    label: "Recusadas",
    empty: "Nenhuma cotação recusada neste filtro.",
  },
];

export default async function ExternalApproverQuotationsPage({ searchParams }: PageProps) {
  const session = await requireExternalApprover();
  const params = await searchParams;
  const tab = (params.tab as ExternalQuotationTab) || "pendentes";
  const activeTab = TABS.some((item) => item.key === tab) ? tab : "pendentes";

  const [pendentes, aprovadas, recusadas, quotations] = await Promise.all([
    listExternalApproverQuotations({
      userId: session.userId,
      organizationId: session.organizationId,
      tab: "pendentes",
    }),
    listExternalApproverQuotations({
      userId: session.userId,
      organizationId: session.organizationId,
      tab: "aprovadas",
    }),
    listExternalApproverQuotations({
      userId: session.userId,
      organizationId: session.organizationId,
      tab: "recusadas",
    }),
    listExternalApproverQuotations({
      userId: session.userId,
      organizationId: session.organizationId,
      tab: activeTab,
    }),
  ]);

  const counts: Record<ExternalQuotationTab, number> = {
    pendentes: pendentes.length,
    aprovadas: aprovadas.length,
    recusadas: recusadas.length,
  };
  const emptyCopy = TABS.find((item) => item.key === activeTab)?.empty ?? "Nenhuma cotação.";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#c10089]">Cota Service</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Minhas Cotações</h1>
        <p className="mt-2 text-neutral-600">
          Compare propostas, revise o RIF publicado e aprove ou recuse a indicação do Master.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={`/app/aprovador/cotacoes?tab=${item.key}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              activeTab === item.key
                ? "bg-[#c10089] text-white"
                : "bg-white text-neutral-700 ring-1 ring-black/10"
            }`}
          >
            {item.label} ({counts[item.key]})
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/80">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Condomínio</th>
              <th className="px-4 py-3 font-medium">Serviço</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 font-medium">Atualização</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  {emptyCopy}
                </td>
              </tr>
            ) : (
              quotations.map((quotation) => {
                const hasRif = (quotation.rifAnalyses?.length ?? 0) > 0;
                const situation =
                  activeTab === "pendentes"
                    ? hasRif
                      ? "Aguardando sua decisão"
                      : "Sem RIF publicado"
                    : activeTab === "aprovadas"
                      ? "Aprovada"
                      : "Recusada";
                return (
                  <tr key={quotation.id} className="border-b border-black/5 last:border-0">
                    <td className="px-4 py-3 font-semibold">{quotation.publicId}</td>
                    <td className="px-4 py-3">{quotation.condominium.name}</td>
                    <td className="px-4 py-3">
                      {quotation.category.name} · {quotation.serviceItem.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                          activeTab === "pendentes"
                            ? "bg-amber-50 text-amber-900 ring-amber-200"
                            : activeTab === "aprovadas"
                              ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                              : "bg-neutral-50 text-neutral-700 ring-black/10"
                        }`}
                      >
                        {situation}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {formatDateTimePt(quotation.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/app/aprovador/cotacoes/${quotation.id}`}
                        className="font-semibold text-[#c10089]"
                      >
                        {activeTab === "pendentes" ? "Analisar" : "Abrir"}
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
