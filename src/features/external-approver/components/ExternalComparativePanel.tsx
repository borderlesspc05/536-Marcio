import { formatPriceCents } from "@/features/billing/money";
import type { RifComparativeRow } from "@/features/master-service/rif";

type ProposalRow = {
  id: string;
  organization: { name: string };
  status: string;
  conditions: Array<{ amountCents: number; paymentTerms: string }>;
};

type RifBlock = {
  id?: string;
  summaryMarkdown: string;
  averageCents: number | null;
  comparativeJson: string;
};

type Props = {
  proposals: ProposalRow[];
  approvedProposalId: string | null;
  rif?: RifBlock | null;
  quotationId?: string;
};

function parseComparative(json: string): RifComparativeRow[] {
  try {
    const parsed = JSON.parse(json) as RifComparativeRow[] | { rows?: RifComparativeRow[] };
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
    return [];
  } catch {
    return [];
  }
}

export function ExternalComparativePanel({
  proposals,
  approvedProposalId,
  rif,
  quotationId,
}: Props) {
  const comparativeRows = rif ? parseComparative(rif.comparativeJson) : [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-neutral-900">Quadro comparativo</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Valores e condições de pagamento das propostas recebidas.
            </p>
          </div>
          {quotationId ? (
            <a
              href={`/api/app/quotations/${quotationId}/proposals-export`}
              className="rounded-xl border border-[#c10089]/30 px-3 py-1.5 text-xs font-semibold text-[#c10089]"
            >
              Baixar propostas
            </a>
          ) : null}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-black/5 text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Fornecedor</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Pagamento</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((proposal) => {
                const best = [...proposal.conditions].sort(
                  (a, b) => a.amountCents - b.amountCents,
                )[0];
                const isWinner = proposal.id === approvedProposalId;
                return (
                  <tr
                    key={proposal.id}
                    className={`border-b border-black/5 last:border-0 ${isWinner ? "bg-emerald-50/60" : ""}`}
                  >
                    <td className="px-3 py-3 font-medium">{proposal.organization.name}</td>
                    <td className="px-3 py-3">
                      {best ? formatPriceCents(best.amountCents) : "—"}
                    </td>
                    <td className="px-3 py-3">{best?.paymentTerms ?? "—"}</td>
                    <td className="px-3 py-3 capitalize">
                      {isWinner ? "Indicada pelo Master" : proposal.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {rif ? (
        <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-neutral-900">Análise RIF</h2>
            {rif.id ? (
              <a
                href={`/api/app/rif/${rif.id}`}
                className="rounded-xl bg-[#c10089] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Baixar RIF
              </a>
            ) : null}
          </div>
          {rif.averageCents != null ? (
            <p className="mt-1 text-sm text-neutral-600">
              Média: {formatPriceCents(rif.averageCents)}
            </p>
          ) : null}
          {comparativeRows.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-neutral-700">
              {comparativeRows.map((row) => (
                <li key={row.proposalId}>
                  {row.supplierName}: {formatPriceCents(row.amountCents)} ({row.paymentTerms})
                </li>
              ))}
            </ul>
          ) : null}
          <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-neutral-50 p-4 text-xs text-neutral-700">
            {rif.summaryMarkdown}
          </pre>
        </section>
      ) : (
        <p className="text-sm text-neutral-500">RIF ainda não publicado para esta cotação.</p>
      )}
    </div>
  );
}
