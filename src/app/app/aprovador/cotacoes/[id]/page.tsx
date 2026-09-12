import Link from "next/link";
import { notFound } from "next/navigation";
import { requireExternalApprover } from "@/features/external-approver/guards";
import { getExternalApproverQuotation } from "@/features/external-approver/data";
import { ExternalComparativePanel } from "@/features/external-approver/components/ExternalComparativePanel";
import { ExternalApprovalModal } from "@/features/external-approver/components/ExternalApprovalModal";

type PageProps = { params: Promise<{ id: string }> };

export default async function ExternalApproverQuotationDetailPage({ params }: PageProps) {
  const session = await requireExternalApprover();
  const { id } = await params;

  const quotation = await getExternalApproverQuotation({
    userId: session.userId,
    organizationId: session.organizationId,
    quotationId: id,
  });
  if (!quotation) notFound();

  const pending = !quotation.externalApproval;
  const rif = quotation.rifAnalyses[0] ?? null;
  const hasIndicated = Boolean(quotation.approvedProposalId);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/aprovador/cotacoes" className="text-sm font-semibold text-[#c10089]">
          ← Minhas Cotações
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-neutral-900">{quotation.publicId}</h1>
        <p className="mt-2 text-neutral-600">
          {quotation.condominium.name} · {quotation.category.name} · {quotation.serviceItem.name}
        </p>
      </div>

      {pending ? (
        <section className="space-y-2 rounded-2xl border border-[#c10089]/20 bg-[#FFF7FB] p-4 text-sm text-[#9a006e]">
          <p className="font-semibold">Sua decisão fecha o fluxo e libera o contato ao fornecedor.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {hasIndicated
                ? "Há proposta indicada pelo Aceite Master (destaque no quadro)."
                : "Aguarde indicação do Master — ainda sem proposta destacada."}
            </li>
            <li>
              {rif
                ? "RIF publicado disponível abaixo (baixe se precisar)."
                : "RIF ainda não publicado — peça ao Master Service publicar a análise."}
            </li>
            <li>Aprovar confirma o vencedor; Recusar devolve o caso à operação.</li>
          </ul>
        </section>
      ) : null}

      <ExternalComparativePanel
        quotationId={quotation.id}
        proposals={quotation.proposals}
        approvedProposalId={quotation.approvedProposalId}
        rif={
          rif
            ? {
                id: rif.id,
                summaryMarkdown: rif.summaryMarkdown,
                averageCents: rif.averageCents,
                comparativeJson: rif.comparativeJson,
              }
            : null
        }
      />

      {pending ? (
        <div className="flex flex-wrap gap-3">
          <ExternalApprovalModal quotationId={quotation.id} />
          <ExternalApprovalModal
            quotationId={quotation.id}
            mode="reject"
            triggerLabel="Recusar"
            triggerVariant="secondary"
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {quotation.externalApproval?.rejected
            ? `Recusada: ${quotation.externalApproval.reason}`
            : `Aprovada: ${quotation.externalApproval?.reason}`}
        </div>
      )}
    </div>
  );
}
