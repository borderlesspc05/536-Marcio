import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { QuotationComparePanel } from "@/features/negotiation/components/QuotationComparePanel";
import {
  QuotationActivityTimeline,
  buildQuotationActivityTimeline,
} from "@/features/negotiation/components/QuotationActivityTimeline";

type PageProps = { params: Promise<{ id: string }> };

export default async function CotacaoDetalhePage({ params }: PageProps) {
  const session = await requireAuthorizedSession({ href: "/app/cotacoes" });
  const { id } = await params;

  const quotation = await firestoreDb.quotation.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      condominium: true,
      category: true,
      serviceItem: true,
      attachments: true,
      rifAnalyses: {
        where: { status: "published" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      invites: {
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              googleProfileUrl: true,
              reclameAquiUrl: true,
              complianceDocuments: { select: { status: true } },
            },
          },
        },
        orderBy: [{ priorityTier: "asc" }, { createdAt: "asc" }],
      },
      proposals: {
        include: {
          conditions: {
            include: { attachments: true },
            orderBy: { sortOrder: "asc" },
          },
          organization: {
            select: {
              id: true,
              name: true,
              googleProfileUrl: true,
              reclameAquiUrl: true,
              complianceDocuments: { select: { status: true } },
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: { organization: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!quotation) notFound();

  const publishedRif = quotation.rifAnalyses[0] ?? null;
  const canDownloadRif = Boolean(
    publishedRif && quotation.rifVisibleToClient && publishedRif.status === "published",
  );
  const canDownloadProposals = quotation.proposals.length > 0;

  const rows = quotation.proposals.flatMap((proposal) =>
    proposal.conditions.map((condition) => ({
      proposalId: proposal.id,
      conditionId: condition.id,
      supplierName: proposal.organization.name,
      supplierOrgId: proposal.organization.id,
      status: proposal.status,
      amountCents: condition.amountCents,
      paymentTerms: condition.paymentTerms,
      attachmentName: condition.attachments[0]?.fileName ?? null,
      attachmentHref: condition.attachments[0]
        ? `/api/app/files?path=${encodeURIComponent(condition.attachments[0].storagePath)}&name=${encodeURIComponent(condition.attachments[0].fileName)}`
        : null,
      createdAt: proposal.createdAt.toISOString(),
      googleProfileUrl: proposal.organization.googleProfileUrl,
      reclameAquiUrl: proposal.organization.reclameAquiUrl,
      complianceApproved: proposal.organization.complianceDocuments.filter(
        (d) => d.status === "aprovado",
      ).length,
      complianceTotal: proposal.organization.complianceDocuments.length,
    })),
  );

  const messages = quotation.proposals.flatMap((proposal) =>
    proposal.messages.map((message) => ({
      id: message.id,
      proposalId: proposal.id,
      body: message.body,
      authorLabel: message.organization.name,
      createdAt: message.createdAt.toISOString(),
    })),
  );

  const statusLabel =
    quotation.status === "finalizada_outros"
      ? "Finalizada — Outros"
      : quotation.status.replace("_", " ");

  const activityItems = buildQuotationActivityTimeline({
    createdAt: quotation.createdAt,
    updatedAt: quotation.updatedAt,
    status: quotation.status,
    otherCompanyName: quotation.otherCompanyName,
    messages: messages.map((message) => ({
      id: message.id,
      body: message.body,
      authorLabel: message.authorLabel,
      createdAt: message.createdAt,
    })),
    approvedLabel:
      quotation.status === "aprovada"
        ? "Proposta aprovada / cotação encerrada"
        : undefined,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/app/cotacoes" className="text-sm text-[#9333EA] hover:underline">
          ← Voltar
        </Link>
        <p className="mt-3 font-mono text-sm font-semibold text-[#9333EA]">{quotation.publicId}</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">
          {quotation.category.name} · {quotation.serviceItem.name}
        </h1>
        <p className="mt-2 text-neutral-600">{quotation.condominium.name}</p>
        {(canDownloadProposals || canDownloadRif) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {canDownloadProposals ? (
              <a
                href={`/api/app/quotations/${quotation.id}/proposals-export`}
                className="inline-flex rounded-xl bg-[#9333EA] px-3 py-2 text-sm font-semibold text-white"
              >
                Baixar propostas
              </a>
            ) : null}
            {canDownloadRif && publishedRif ? (
              <a
                href={`/api/app/rif/${publishedRif.id}`}
                className="inline-flex rounded-xl border border-[#9333EA]/30 px-3 py-2 text-sm font-semibold text-[#9333EA]"
              >
                Baixar RIF (HTML/PDF)
              </a>
            ) : null}
          </div>
        )}
        {!canDownloadRif && quotation.serviceManagedByOrgId ? (
          <p className="mt-2 text-xs text-neutral-500">
            RIF disponível para download após publicação/liberação pela operação Cota Service.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-black/5 bg-white/80 p-4">
          <p className="text-xs text-neutral-500">Status</p>
          <p className="mt-1 font-semibold capitalize">{statusLabel}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-4">
          <p className="text-xs text-neutral-500">Urgência</p>
          <p className="mt-1 font-semibold capitalize">{quotation.urgency}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-4">
          <p className="text-xs text-neutral-500">Metas</p>
          <p className="mt-1 font-semibold">
            min {quotation.minProposals} · máx {quotation.maxProposals}
          </p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-4">
          <p className="text-xs text-neutral-500">Propostas</p>
          <p className="mt-1 font-semibold">{quotation.proposalsCount}</p>
        </div>
      </div>

      {(quotation.serviceItem.isMandatory || quotation.serviceItem.periodicityHint) && (
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {quotation.serviceItem.isMandatory ? <strong>Serviço obrigatório. </strong> : null}
          {quotation.serviceItem.periodicityHint
            ? `Periodicidade: ${quotation.serviceItem.periodicityHint}.`
            : null}
        </div>
      )}

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">Descrição</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{quotation.description}</p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">Anexos</h2>
        {quotation.attachments.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Nenhum anexo.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {quotation.attachments.map((file) => (
              <li key={file.id} className="flex justify-between gap-4 border-b border-black/5 py-2">
                <span>{file.fileName}</span>
                <span className="text-neutral-500">{Math.round(file.sizeBytes / 1024)} KB</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <QuotationComparePanel
        quotationId={quotation.id}
        quotationStatus={quotation.status}
        invitesPaused={quotation.invitesPaused}
        minProposals={quotation.minProposals}
        maxProposals={quotation.maxProposals}
        proposalsCount={quotation.proposalsCount}
        rows={rows}
        messages={messages}
        invites={quotation.invites.map((invite) => ({
          id: invite.id,
          supplierName: invite.supplier.name,
          status: invite.status,
          tier: invite.priorityTier,
          reason: invite.selectionReason,
          acceptedAt: invite.acceptedAt?.toISOString() ?? null,
        }))}
        otherCompanyName={quotation.otherCompanyName}
        otherFinalAmountCents={quotation.otherFinalAmountCents}
      />

      <QuotationActivityTimeline items={activityItems} />
    </div>
  );
}
