import Link from "next/link";
import { notFound } from "next/navigation";
import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { getServiceQuotation } from "@/features/master-service/data";
import { SERVICE_PIPELINE_LABELS, SERVICE_PIPELINE_ORDER } from "@/features/master-service/pipeline";
import {
  dispatchServiceQuotationAction,
  generateRifAction,
  markServiceExternalApprovalAction,
  markServiceRejectedAction,
  masterAcceptProposalAction,
  setServicePipelineStatusAction,
  solicitanteConfirmAcceptAction,
} from "@/features/master-service/actions";
import { formAction } from "@/lib/form-action";
import { formatPriceCents } from "@/features/billing/money";
import { Button } from "@/components/ui/Button";

type PageProps = { params: Promise<{ id: string }> };

export default async function ServiceCotacaoDetailPage({ params }: PageProps) {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.master_service],
  });
  const { id } = await params;
  const quotation = await getServiceQuotation(id, session.organizationId);
  if (!quotation) notFound();

  const brand = quotation.serviceClient;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app/service/cotacoes" className="text-sm font-semibold text-[#9333EA]">
            ← Pipeline
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900">{quotation.publicId}</h1>
          <p className="mt-2 text-neutral-600">
            {quotation.condominium.name} · {quotation.category.name} ·{" "}
            {quotation.serviceItem.name}
          </p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm">
          <p className="text-neutral-500">Pipeline</p>
          <p className="font-semibold">
            {quotation.servicePipelineStatus
              ? SERVICE_PIPELINE_LABELS[quotation.servicePipelineStatus]
              : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-black/5 bg-white/80 p-5 lg:col-span-2">
          <h2 className="font-semibold">Dados do solicitante</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Nome</dt>
              <dd className="font-medium">{quotation.requesterName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Cargo</dt>
              <dd className="font-medium">{quotation.requesterRole ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">E-mail</dt>
              <dd className="font-medium">{quotation.requesterEmail ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Telefone</dt>
              <dd className="font-medium">{quotation.requesterPhone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">CNPJ condomínio</dt>
              <dd className="font-medium">{quotation.condominium.document ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Cliente Cota Service</dt>
              <dd className="font-medium">
                {brand?.displayName ?? quotation.organization.name}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-amber-700">
            Blindagem: propostas aos fornecedores saem como CotaCondo, citando apenas{" "}
            {brand?.displayName ?? quotation.organization.name}, sem contato direto nesta fase.
            Contato liberado apenas após aceite final.
          </p>
        </section>

        <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <h2 className="font-semibold">Ações do Master</h2>
          <form action={formAction(setServicePipelineStatusAction)} className="mt-3 space-y-2">
            <input type="hidden" name="quotationId" value={quotation.id} />
            <select
              name="status"
              defaultValue={quotation.servicePipelineStatus ?? "em_liberacao"}
              className="h-10 w-full rounded-xl border border-black/10 px-3 text-sm"
            >
              {SERVICE_PIPELINE_ORDER.map((status) => (
                <option key={status} value={status}>
                  {SERVICE_PIPELINE_LABELS[status]}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary" className="w-full">
              Atualizar pipeline
            </Button>
          </form>
          <form action={formAction(dispatchServiceQuotationAction)} className="mt-3">
            <input type="hidden" name="quotationId" value={quotation.id} />
            <Button type="submit" className="w-full">
              Disparar / Em Andamento
            </Button>
          </form>
          <form action={formAction(markServiceRejectedAction)} className="mt-2">
            <input type="hidden" name="quotationId" value={quotation.id} />
            <Button type="submit" variant="secondary" className="w-full">
              Marcar recusada
            </Button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Propostas e negociação</h2>
        <div className="mt-4 space-y-4">
          {quotation.proposals.length === 0 ? (
            <p className="text-sm text-neutral-500">Ainda sem propostas.</p>
          ) : (
            quotation.proposals.map((proposal) => (
              <div key={proposal.id} className="rounded-xl border border-black/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{proposal.organization.name}</p>
                    <p className="text-xs text-neutral-500">Status: {proposal.status}</p>
                  </div>
                  {proposal.status !== "recusada" ? (
                    <form action={formAction(masterAcceptProposalAction)}>
                      <input type="hidden" name="quotationId" value={quotation.id} />
                      <input type="hidden" name="proposalId" value={proposal.id} />
                      <Button type="submit" size="sm">
                        Aceite Master
                      </Button>
                    </form>
                  ) : null}
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {proposal.conditions.map((condition) => (
                    <li key={condition.id}>
                      {formatPriceCents(condition.amountCents)} — {condition.paymentTerms}
                    </li>
                  ))}
                </ul>
                {proposal.messages.length > 0 ? (
                  <div className="mt-3 space-y-1 rounded-lg bg-neutral-50 p-3 text-xs">
                    {proposal.messages.map((message) => (
                      <p key={message.id}>{message.body}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <h2 className="font-semibold">Análise RIF</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Gatilho manual. Visibilidade ao cliente só após aceite/publicação do Master.
            Identidade visual: {brand?.primaryColor ?? "#9333EA"} / logo{" "}
            {brand?.logoUrl ? "configurado" : "padrão"}.
          </p>
          <form action={formAction(generateRifAction)} className="mt-4 flex flex-wrap gap-3">
            <input type="hidden" name="quotationId" value={quotation.id} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="publish" />
              Publicar para o solicitante
            </label>
            <Button type="submit">Gerar Análise RIF</Button>
          </form>
          <div className="mt-4 space-y-3">
            {quotation.rifAnalyses.map((rif) => (
              <article
                key={rif.id}
                className="rounded-xl border border-black/5 p-4 text-sm"
                style={{
                  borderTopColor: brand?.primaryColor ?? "#9333EA",
                  borderTopWidth: 3,
                }}
              >
                <p className="text-xs text-neutral-500">
                  {rif.status} · média{" "}
                  {rif.averageCents != null ? formatPriceCents(rif.averageCents) : "—"}
                </p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-neutral-700">
                  {rif.summaryMarkdown}
                </pre>
                {rif.aiInsights ? (
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 font-sans text-xs text-neutral-600">
                    {rif.aiInsights}
                  </pre>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-black/5 bg-white/80 p-5 space-y-4">
          <div>
            <h2 className="font-semibold">Encerramento</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Após aceite do solicitante: aprova vencedor, recusa demais e libera contato.
            </p>
            <form action={formAction(solicitanteConfirmAcceptAction)} className="mt-3">
              <input type="hidden" name="quotationId" value={quotation.id} />
              <Button type="submit" disabled={!quotation.masterAcceptedAt}>
                Confirmar aceite do solicitante
              </Button>
            </form>
          </div>
          <div className="border-t border-black/5 pt-4">
            <h3 className="font-medium">Aprovado com fornecedor externo</h3>
            <form
              action={formAction(markServiceExternalApprovalAction)}
              className="mt-3 grid gap-2"
            >
              <input type="hidden" name="quotationId" value={quotation.id} />
              <input
                name="companyName"
                required
                placeholder="Nome da empresa"
                className="h-10 rounded-xl border border-black/10 px-3 text-sm"
              />
              <input
                name="amountReais"
                required
                placeholder="Valor fechado (ex: 12500.00)"
                className="h-10 rounded-xl border border-black/10 px-3 text-sm"
              />
              <Button type="submit" variant="secondary">
                Registrar aprovação externa
              </Button>
            </form>
          </div>
          {quotation.contactReleasedAt ? (
            <p className="text-sm text-emerald-700">
              Contato do solicitante liberado ao fornecedor em{" "}
              {quotation.contactReleasedAt.toLocaleString("pt-BR")}.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
