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
import { ServiceActionForm } from "@/features/master-service/components/ServiceActionForm";
import {
  ServiceOpsChips,
  ServiceOpsNextStep,
} from "@/features/master-service/components/ServiceOpsBadges";
import { getServiceOpsSnapshot } from "@/features/master-service/ops-status";
import { formatDateTimePt } from "@/lib/format-date";
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
  const ops = getServiceOpsSnapshot(quotation);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app/service/cotacoes" className="text-sm font-semibold text-[#c10089]">
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

      <section className="space-y-3 rounded-2xl border border-black/5 bg-white/90 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-neutral-800">Status da operação</p>
          {ops.rifVisibleToClient ? (
            <span className="text-xs font-semibold text-emerald-700">Visível ao solicitante</span>
          ) : (
            <span className="text-xs text-neutral-500">Ainda não liberado ao solicitante</span>
          )}
        </div>
        <ServiceOpsChips ops={ops} />
        <ServiceOpsNextStep ops={ops} />
      </section>

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
          <ServiceActionForm action={setServicePipelineStatusAction} className="mt-3 space-y-2">
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
          </ServiceActionForm>
          <ServiceActionForm
            action={dispatchServiceQuotationAction}
            className="mt-3"
            pendingLabel="Disparando convites…"
          >
            <input type="hidden" name="quotationId" value={quotation.id} />
            <Button type="submit" className="w-full">
              Disparar / Em Andamento
            </Button>
          </ServiceActionForm>
          <ServiceActionForm action={markServiceRejectedAction} className="mt-2">
            <input type="hidden" name="quotationId" value={quotation.id} />
            <Button type="submit" variant="secondary" className="w-full">
              Marcar recusada
            </Button>
          </ServiceActionForm>
        </section>
      </div>

      <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Propostas e negociação</h2>
        {quotation.masterAcceptedAt ? (
          <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Aceite Master registrado em {formatDateTimePt(quotation.masterAcceptedAt)}. Pipeline em
            análise — o botão &quot;Confirmar aceite do solicitante&quot; já pode ser usado.
          </p>
        ) : null}
        <div className="mt-4 space-y-4">
          {quotation.proposals.length === 0 ? (
            <p className="text-sm text-neutral-500">Ainda sem propostas.</p>
          ) : (
            quotation.proposals.map((proposal) => {
              const isMasterPick = quotation.approvedProposalId === proposal.id;
              return (
                <div
                  key={proposal.id}
                  className={`rounded-xl border p-4 ${
                    isMasterPick ? "border-emerald-300 bg-emerald-50/40" : "border-black/5"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{proposal.organization.name}</p>
                      <p className="text-xs text-neutral-500">Status: {proposal.status}</p>
                      {isMasterPick ? (
                        <p className="mt-1 text-xs font-semibold text-emerald-700">
                          Indicada pelo Aceite Master
                        </p>
                      ) : null}
                    </div>
                    {proposal.status !== "recusada" ? (
                      <ServiceActionForm action={masterAcceptProposalAction}>
                        <input type="hidden" name="quotationId" value={quotation.id} />
                        <input type="hidden" name="proposalId" value={proposal.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant={isMasterPick ? "secondary" : "primary"}
                        >
                          {isMasterPick ? "Trocar indicação" : "Aceite Master"}
                        </Button>
                      </ServiceActionForm>
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
              );
            })
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <h2 className="font-semibold">Análise RIF</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Modelo executivo padrão (Objetivo → Encerramento). Só gera com{" "}
            <strong>2 ou mais propostas</strong> para não consumir token à toa. Rascunho não aparece
            para o solicitante — marque &quot;Publicar&quot; para liberar.
            {brand ? (
              <>
                {" "}
                Whitelabel Service: {brand.primaryColor} / logo{" "}
                {brand.logoUrl ? "configurado" : "padrão CotaCondo"}.
              </>
            ) : null}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/api/app/quotations/${quotation.id}/proposals-export`}
              target="_blank"
              rel="noreferrer"
            >
              <Button type="button" variant="secondary" size="sm">
                Baixar propostas
              </Button>
            </a>
          </div>
          {quotation.proposals.length < 2 ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Aguarde pelo menos 2 propostas para acionar a Análise RIF (
              {quotation.proposals.length} recebida
              {quotation.proposals.length === 1 ? "" : "s"}).
            </p>
          ) : (
            <ServiceActionForm
              action={generateRifAction}
              className="mt-4 flex flex-wrap items-center gap-3"
              pendingLabel="Gerando Análise RIF…"
            >
              <input type="hidden" name="quotationId" value={quotation.id} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="publish" />
                Publicar para o solicitante
              </label>
              <Button type="submit">Gerar Análise RIF</Button>
            </ServiceActionForm>
          )}
          <div className="mt-4 space-y-3">
            {quotation.rifAnalyses.map((rif) => (
              <article
                key={rif.id}
                className="rounded-xl border border-black/5 p-4 text-sm"
                style={{
                  borderTopColor: brand?.primaryColor ?? "#c10089",
                  borderTopWidth: 3,
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-neutral-500">
                    {rif.status} · média{" "}
                    {rif.averageCents != null ? formatPriceCents(rif.averageCents) : "—"}
                  </p>
                  <a href={`/api/app/rif/${rif.id}`} target="_blank" rel="noreferrer">
                    <Button type="button" size="sm" variant="secondary">
                      Baixar RIF (HTML/PDF)
                    </Button>
                  </a>
                </div>
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

        <section className="space-y-4 rounded-2xl border border-black/5 bg-white/80 p-5">
          <div>
            <h2 className="font-semibold">Encerramento</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Após aceite do solicitante: aprova vencedor, recusa demais e libera contato.
            </p>
            <ServiceActionForm action={solicitanteConfirmAcceptAction} className="mt-3">
              <input type="hidden" name="quotationId" value={quotation.id} />
              <Button type="submit" disabled={!quotation.masterAcceptedAt}>
                Confirmar aceite do solicitante
              </Button>
            </ServiceActionForm>
            {!quotation.masterAcceptedAt ? (
              <p className="mt-2 text-xs text-amber-700">
                Faça o Aceite Master em uma proposta acima para habilitar este passo.
              </p>
            ) : null}
          </div>
          <div className="border-t border-black/5 pt-4">
            <h3 className="font-medium">Aprovado com fornecedor externo</h3>
            <ServiceActionForm
              action={markServiceExternalApprovalAction}
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
            </ServiceActionForm>
          </div>
          {quotation.contactReleasedAt ? (
            <p className="text-sm text-emerald-700">
              Contato do solicitante liberado ao fornecedor em{" "}
              {formatDateTimePt(quotation.contactReleasedAt)}.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
