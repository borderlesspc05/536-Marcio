import Link from "next/link";
import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { DeclineInviteForm } from "@/features/opportunities/components/DeclineInviteForm";
import { ProposalForm } from "@/features/opportunities/components/ProposalForm";
import { SupplierNegotiationPanel } from "@/features/negotiation/components/SupplierNegotiationPanel";
import {
  getSupplierFranchiseBalance,
  assertSupplierCanAccessCategory,
  getSupplierPlanInfo,
} from "@/features/supplier/franchise";
import { markOverdueCompliance } from "@/features/compliance/expire";
import { Button } from "@/components/ui/Button";
import { MonthYearSelect } from "@/components/ui/MonthYearSelect";
import { acceptInviteAction } from "@/features/opportunities/actions";
import {
  SupplierKanbanBoard,
  type SupplierKanbanCard,
} from "@/features/opportunities/components/SupplierKanbanBoard";
import { deriveSupplierPipelineStage } from "@/features/opportunities/pipeline";
import { formatPriceCents } from "@/features/billing/money";
import {
  isQuotationVisibleToSupplier,
  supplierFacingQuotationLabel,
} from "@/features/opportunities/visibility";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    categoryId?: string;
    yearMonth?: string;
    view?: string;
    inviteId?: string;
  }>;
};

export default async function OportunidadesPage({ searchParams }: PageProps) {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.fornecedor],
    href: "/app/oportunidades",
  });

  const params = await searchParams;
  const query = params.q?.trim();
  const statusFilter = params.status?.trim();
  const categoryId = params.categoryId?.trim();
  const yearMonth = params.yearMonth?.trim();
  const view = params.view === "lista" ? "lista" : "kanban";
  const focusInviteId = params.inviteId?.trim();

  await markOverdueCompliance(session.organizationId);

  let periodFilter: { gte?: Date; lt?: Date } | undefined;
  if (yearMonth && /^\d{4}-\d{2}$/.test(yearMonth)) {
    const [y, m] = yearMonth.split("-").map(Number);
    const start = new Date(Date.UTC(y!, m! - 1, 1));
    const end = new Date(Date.UTC(y!, m!, 1));
    periodFilter = { gte: start, lt: end };
  }

  const [franchise, overdueDocs, planInfo, invitesRaw] = await Promise.all([
    getSupplierFranchiseBalance(session.organizationId),
    firestoreDb.complianceDocument.count({
      where: { organizationId: session.organizationId, status: "em_atraso" },
    }),
    getSupplierPlanInfo(session.organizationId),
    firestoreDb.quotationInvite.findMany({
      where: {
        supplierOrgId: session.organizationId,
        ...(statusFilter ? { status: statusFilter as "pendente" | "aceito" | "declinado" | "expirado" } : {}),
        ...(categoryId ? { quotation: { categoryId } } : {}),
        ...(periodFilter ? { createdAt: periodFilter } : {}),
        ...(query
          ? {
              OR: [
                { quotation: { publicId: { contains: query } } },
                { quotation: { condominium: { name: { contains: query } } } },
              ],
            }
          : {}),
      },
      include: {
        quotation: {
          include: {
            category: true,
            serviceItem: true,
            condominium: true,
            attachments: true,
          },
        },
        proposal: {
          include: {
            conditions: { include: { attachments: true }, orderBy: { sortOrder: "asc" } },
            messages: {
              orderBy: { createdAt: "asc" },
              include: { organization: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const categories = planInfo.categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));

  const invites = invitesRaw.filter((invite) =>
    isQuotationVisibleToSupplier({
      status: invite.quotation.status,
      servicePipelineStatus: invite.quotation.servicePipelineStatus,
    }),
  );

  const kanbanCards: SupplierKanbanCard[] = invites.map((invite) => {
    const firstCondition = invite.proposal?.conditions[0];
    return {
      id: invite.id,
      publicId: invite.quotation.publicId,
      description: invite.quotation.description,
      categoryName: invite.quotation.category.name,
      serviceName: invite.quotation.serviceItem.name,
      condominiumName: invite.quotation.condominium.name,
      urgency: invite.quotation.urgency,
      createdAt: invite.createdAt.toISOString(),
      proposalValue: firstCondition ? formatPriceCents(firstCondition.amountCents) : null,
      proposalValueCents: firstCondition?.amountCents ?? null,
      officialStatus: supplierFacingQuotationLabel({
        status: invite.quotation.status,
        servicePipelineStatus: invite.quotation.servicePipelineStatus,
      }),
      stage: deriveSupplierPipelineStage({
        savedStage: invite.supplierPipelineStage,
        inviteStatus: invite.status,
        proposalStatus: invite.proposal?.status,
      }),
    };
  });

  const focusInvite = focusInviteId
    ? invites.find((invite) => invite.id === focusInviteId)
    : null;

  let categoryBlocked = false;
  if (focusInvite) {
    try {
      await assertSupplierCanAccessCategory(
        session.organizationId,
        focusInvite.quotation.categoryId,
        focusInvite.quotation.serviceItemId,
      );
    } catch {
      categoryBlocked = true;
    }
  }

  const blockMessage = !franchise.canSubmitProposal
    ? "Limite mensal do plano Free esgotado (1 cotação/mês). Faça upgrade."
    : overdueDocs > 0
      ? "Há documentos em atraso. Regularize o compliance antes de enviar proposta."
      : categoryBlocked
        ? "Categoria fora do seu pacote. Ajuste em Meu Plano ou faça upgrade."
        : undefined;

  const canSubmit =
    franchise.canSubmitProposal && overdueDocs === 0 && !categoryBlocked;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">
            Oportunidades
          </p>
          <h1 className="mt-1 text-3xl font-bold text-neutral-900">Painel do fornecedor</h1>
          <p className="mt-2 text-neutral-600">
            Saldo do mês:{" "}
            {franchise.isUnlimited ? "∞" : `${franchise.remaining ?? 0} restante(s)`}
            {overdueDocs > 0 ? ` · ${overdueDocs} doc(s) em atraso` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/oportunidades?view=kanban">
            <Button variant={view === "kanban" ? "primary" : "secondary"} size="sm">
              Kanban
            </Button>
          </Link>
          <Link href="/app/oportunidades?view=lista">
            <Button variant={view === "lista" ? "primary" : "secondary"} size="sm">
              Lista
            </Button>
          </Link>
        </div>
      </div>

      <form className="grid gap-2 md:grid-cols-5">
        <input type="hidden" name="view" value={view} />
        <input
          name="q"
          defaultValue={query}
          placeholder="Buscar ID ou condomínio"
          className="h-11 rounded-xl border border-black/10 px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={statusFilter ?? ""}
          className="h-11 rounded-xl border border-black/10 px-3 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="aceito">Aceito</option>
          <option value="declinado">Declinado</option>
        </select>
        <select
          name="categoryId"
          defaultValue={categoryId ?? ""}
          className="h-11 rounded-xl border border-black/10 px-3 text-sm"
        >
          <option value="">Categorias do meu plano</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {categories.length === 0 ? (
          <p className="md:col-span-5 text-xs text-amber-700">
            Nenhuma categoria no pacote. Configure em Meu Plano para filtrar oportunidades.
          </p>
        ) : null}
        <MonthYearSelect name="yearMonth" defaultValue={yearMonth ?? ""} />
        <button type="submit" className="h-11 rounded-xl bg-black/[0.04] px-4 text-sm font-semibold">
          Filtrar
        </button>
      </form>

      {view === "kanban" ? (
        <SupplierKanbanBoard initialCards={kanbanCards} />
      ) : (
        <div className="space-y-4">
          {invites.map((invite) => {
            const expanded = focusInviteId === invite.id;
            return (
              <div key={invite.id} className="rounded-2xl border border-black/5 bg-white/80 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-neutral-900">
                      {invite.quotation.publicId} · {invite.quotation.category.name}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600">
                      {invite.quotation.serviceItem.name} · Urgência {invite.quotation.urgency}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Status solicitante:{" "}
                      {supplierFacingQuotationLabel({
                        status: invite.quotation.status,
                        servicePipelineStatus: invite.quotation.servicePipelineStatus,
                      })}
                      {" · "}
                      Convite: {invite.status}
                      {invite.proposal ? ` · Proposta: ${invite.proposal.status}` : ""}
                    </p>
                  </div>
                  <Link
                    href={
                      expanded
                        ? "/app/oportunidades?view=lista"
                        : `/app/oportunidades?view=lista&inviteId=${invite.id}`
                    }
                    className="text-sm font-semibold text-[#9333EA] hover:underline"
                  >
                    {expanded ? "Recolher" : "Detalhes"}
                  </Link>
                </div>

                {expanded ? (
                  <div className="mt-4 space-y-4 border-t border-black/5 pt-4">
                    <p className="text-sm text-neutral-700">{invite.quotation.description}</p>
                    <p className="text-xs text-neutral-500">
                      Condomínio: {invite.quotation.condominium.name} · Anexos:{" "}
                      {invite.quotation.attachments.length}
                    </p>

                    {invite.status === "pendente" ? (
                      <div className="flex flex-wrap gap-2">
                        <form
                          action={async (formData) => {
                            "use server";
                            await acceptInviteAction(formData);
                          }}
                        >
                          <input type="hidden" name="inviteId" value={invite.id} />
                          <Button type="submit" size="sm">
                            Aceitar
                          </Button>
                        </form>
                        <DeclineInviteForm inviteId={invite.id} />
                      </div>
                    ) : null}

                    {invite.status === "declinado" ? (
                      <p className="text-sm text-neutral-500">
                        Declinada
                        {invite.declineReason ? `: ${invite.declineReason}` : "."}
                      </p>
                    ) : null}

                    {invite.proposal ? (
                      <div className="space-y-3">
                        <div className="rounded-xl bg-black/[0.03] p-4 text-sm">
                          <p className="font-semibold">Proposta enviada ({invite.proposal.status})</p>
                          <ul className="mt-2 space-y-1">
                            {invite.proposal.conditions.map((condition, index) => (
                              <li key={condition.id}>
                                #{index + 1}: R${" "}
                                {(condition.amountCents / 100).toFixed(2).replace(".", ",")} —{" "}
                                {condition.paymentTerms}
                                {condition.attachments.length > 0
                                  ? ` · ${condition.attachments[0].fileName}`
                                  : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {invite.proposal.status === "em_negociacao" ||
                        (invite.proposal.messages?.length ?? 0) > 0 ? (
                          <SupplierNegotiationPanel
                            proposalId={invite.proposal.id}
                            canChat={invite.proposal.status === "em_negociacao"}
                            messages={(invite.proposal.messages ?? []).map((message) => ({
                              id: message.id,
                              body: message.body,
                              authorLabel: message.organization.name,
                              createdAt: message.createdAt.toISOString(),
                            }))}
                          />
                        ) : null}
                      </div>
                    ) : invite.status === "aceito" || invite.status === "pendente" ? (
                      <ProposalForm
                        inviteId={invite.id}
                        canSubmit={canSubmit}
                        blockMessage={blockMessage}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {invites.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center text-neutral-500">
              Nenhuma oportunidade encontrada.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
