"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  approveConditionAction,
  approveOthersAction,
  reinforceInviteAction,
  sendNegotiationMessagesBulkAction,
  startNegotiationAction,
} from "@/features/negotiation/actions";

export type CompareRow = {
  proposalId: string;
  conditionId: string;
  supplierName: string;
  supplierOrgId: string;
  status: string;
  amountCents: number;
  paymentTerms: string;
  attachmentName: string | null;
  attachmentHref: string | null;
  createdAt: string;
  googleProfileUrl: string | null;
  reclameAquiUrl: string | null;
  complianceApproved: number;
  complianceTotal: number;
};

type Message = {
  id: string;
  proposalId: string;
  body: string;
  authorLabel: string;
  createdAt: string;
};

type Props = {
  quotationId: string;
  quotationStatus: string;
  invitesPaused: boolean;
  minProposals: number;
  maxProposals: number;
  proposalsCount: number;
  rows: CompareRow[];
  messages: Message[];
  invites: Array<{
    id: string;
    supplierName: string;
    status: string;
    tier: number;
    reason: string | null;
    acceptedAt: string | null;
  }>;
  otherCompanyName: string | null;
  otherFinalAmountCents: number | null;
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function QuotationComparePanel({
  quotationId,
  quotationStatus,
  invitesPaused,
  minProposals,
  maxProposals,
  proposalsCount,
  rows,
  messages,
  invites,
  otherCompanyName,
  otherFinalAmountCents,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sort, setSort] = useState<"amount" | "date">("amount");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [activeCondition, setActiveCondition] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState<"selected" | "all">("selected");
  const [actionMode, setActionMode] = useState<"negociar" | "aprovar" | "outros">("negociar");
  const [chatBody, setChatBody] = useState("Gostaríamos de negociar melhores condições.");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canNegotiate = ["aberta", "em_negociacao"].includes(quotationStatus);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    if (sort === "amount") {
      copy.sort((a, b) => a.amountCents - b.amountCents);
    } else {
      copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return copy;
  }, [rows, sort]);

  const allProposalIds = useMemo(
    () => [...new Set(rows.map((row) => row.proposalId))],
    [rows],
  );

  const selectedProposalIds = Object.entries(selected)
    .filter(([, value]) => value)
    .map(([id]) => id);

  const targetProposalIds = messageTarget === "all" ? allProposalIds : selectedProposalIds;

  const progressPct = Math.min(100, Math.round((proposalsCount / Math.max(maxProposals, 1)) * 100));

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "Erro");
        setFeedback(null);
        return;
      }
      setError(null);
      setFeedback(result.message ?? "OK");
      router.refresh();
    });
  }

  function sendNegotiationMessage() {
    if (targetProposalIds.length === 0) {
      setError(
        messageTarget === "all"
          ? "Não há propostas para enviar a mensagem."
          : "Selecione ao menos uma proposta na tabela ou escolha enviar a todos.",
      );
      setFeedback(null);
      return;
    }
    if (!chatBody.trim()) {
      setError("Digite a mensagem no canal de negociação.");
      setFeedback(null);
      return;
    }

    const formData = new FormData();
    for (const id of targetProposalIds) formData.append("proposalIds", id);
    formData.set("message", chatBody.trim());
    formData.set("body", chatBody.trim());

    if (quotationStatus === "aberta") {
      run(() => startNegotiationAction(formData));
      return;
    }

    run(() => sendNegotiationMessagesBulkAction(formData));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Progresso de propostas</h2>
            <p className="mt-1 text-sm text-neutral-600">
              {proposalsCount} de {maxProposals} (mínimo {minProposals})
            </p>
          </div>
          {invitesPaused || proposalsCount >= maxProposals ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              Recebimento pausado (meta máxima)
            </span>
          ) : null}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className="h-full rounded-full bg-[linear-gradient(135deg,#E11D8A,#9333EA,#3B82F6)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Empresas que aceitaram</h2>
        {invites.filter((i) => i.status === "aceito").length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Nenhuma empresa aceitou ainda.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {invites
              .filter((invite) => invite.status === "aceito")
              .map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 py-2"
                >
                  <span className="font-medium">{invite.supplierName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500">
                      Aceito
                      {invite.acceptedAt
                        ? ` em ${new Date(invite.acceptedAt).toLocaleDateString("pt-BR")}`
                        : ""}
                    </span>
                    {canNegotiate ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          const formData = new FormData();
                          formData.set("inviteId", invite.id);
                          run(() => reinforceInviteAction(formData));
                        }}
                      >
                        Reforçar pedido
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Convites distribuídos</h2>
        {invites.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Nenhum convite ainda.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 py-2"
              >
                <span className="font-medium">{invite.supplierName}</span>
                <span className="text-neutral-500">
                  Tier {invite.tier} · {invite.status}
                  {invite.reason ? ` · ${invite.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">Comparativo de propostas</h2>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as "amount" | "date")}
            className="h-10 rounded-xl border border-black/10 px-3 text-sm"
          >
            <option value="amount">Ordenar por valor</option>
            <option value="date">Ordenar por data</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-black/5 text-neutral-500">
              <tr>
                <th className="px-2 py-2 font-medium">
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={
                        allProposalIds.length > 0 &&
                        allProposalIds.every((id) => Boolean(selected[id]))
                      }
                      onChange={(event) => {
                        const next: Record<string, boolean> = {};
                        for (const id of allProposalIds) next[id] = event.target.checked;
                        setSelected(next);
                        if (event.target.checked) setMessageTarget("all");
                      }}
                      disabled={!canNegotiate}
                      aria-label="Selecionar todos"
                    />
                    Sel.
                  </label>
                </th>
                <th className="px-2 py-2 font-medium">Fornecedor</th>
                <th className="px-2 py-2 font-medium">Reputação</th>
                <th className="px-2 py-2 font-medium">Valor</th>
                <th className="px-2 py-2 font-medium">Pagamento</th>
                <th className="px-2 py-2 font-medium">Anexo</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.conditionId} className="border-b border-black/5">
                  <td className="px-2 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[row.proposalId])}
                      onChange={(event) =>
                        setSelected((prev) => ({
                          ...prev,
                          [row.proposalId]: event.target.checked,
                        }))
                      }
                      disabled={!canNegotiate}
                    />
                  </td>
                  <td className="px-2 py-3 font-medium">{row.supplierName}</td>
                  <td className="px-2 py-3 text-xs">
                    <div className="flex flex-col gap-1">
                      <span className="text-neutral-500">
                        Docs {row.complianceApproved}/{row.complianceTotal}
                      </span>
                      {row.googleProfileUrl ? (
                        <a
                          href={row.googleProfileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#9333EA] hover:underline"
                        >
                          Google
                        </a>
                      ) : null}
                      {row.reclameAquiUrl ? (
                        <a
                          href={row.reclameAquiUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#9333EA] hover:underline"
                        >
                          Reclame Aqui
                        </a>
                      ) : null}
                      {!row.googleProfileUrl && !row.reclameAquiUrl ? (
                        <span className="text-neutral-400">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-3">{formatMoney(row.amountCents)}</td>
                  <td className="px-2 py-3">{row.paymentTerms}</td>
                  <td className="px-2 py-3 text-neutral-500">
                    {row.attachmentHref && row.attachmentName ? (
                      <a
                        href={row.attachmentHref}
                        className="font-semibold text-[#9333EA] hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.attachmentName}
                      </a>
                    ) : (
                      (row.attachmentName ?? "—")
                    )}
                  </td>
                  <td className="px-2 py-3 capitalize">{row.status.replace("_", " ")}</td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      className={`text-xs font-semibold ${
                        activeCondition === row.conditionId
                          ? "text-emerald-700"
                          : "text-[#9333EA] hover:underline"
                      }`}
                      onClick={() => setActiveCondition(row.conditionId)}
                      disabled={!canNegotiate}
                    >
                      {activeCondition === row.conditionId ? "Selecionada" : "Selecionar"}
                    </button>
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-8 text-center text-neutral-500">
                    Nenhuma proposta/condição para comparar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {canNegotiate ? (
          <div className="mt-4 space-y-3">
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Ações da cotação"
            >
              {(
                [
                  { id: "negociar", label: "Negociar selecionadas" },
                  { id: "aprovar", label: "Aprovar condição selecionada" },
                  { id: "outros", label: "Aprovar Outros" },
                ] as const
              ).map((tab) => {
                const active = actionMode === tab.id;
                return (
                  <Button
                    key={tab.id}
                    type="button"
                    size="sm"
                    role="tab"
                    aria-selected={active}
                    variant={active ? "primary" : "secondary"}
                    disabled={pending}
                    onClick={() => setActionMode(tab.id)}
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </div>

            {actionMode === "negociar" ? (
              <div className="space-y-2 rounded-xl border border-black/5 bg-black/[0.02] p-4">
                <p className="text-sm text-neutral-700">
                  Use os checkboxes da tabela para negociar com uma, várias ou todas as empresas.
                  A mensagem fica no <strong>Canal de negociação</strong> abaixo e o histórico entra
                  na timeline de status.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={messageTarget}
                    onChange={(event) => setMessageTarget(event.target.value as "selected" | "all")}
                    className="h-10 rounded-xl border border-black/10 px-3 text-sm"
                  >
                    <option value="selected">Selecionadas na tabela</option>
                    <option value="all">Todas as empresas</option>
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || targetProposalIds.length === 0 || !chatBody.trim()}
                    onClick={sendNegotiationMessage}
                  >
                    Negociar / enviar mensagem
                  </Button>
                  <span className="text-xs text-neutral-500">
                    {messageTarget === "all"
                      ? `${allProposalIds.length} fornecedor(es)`
                      : `${selectedProposalIds.length} selecionada(s)`}
                  </span>
                </div>
              </div>
            ) : null}

            {actionMode === "aprovar" ? (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <p className="text-sm text-emerald-900">
                  Selecione uma condição na tabela e confirme a aprovação. Para voltar à negociação
                  ou a Outros, use as abas acima.
                </p>
                <p className="text-xs text-neutral-600">
                  {activeCondition
                    ? `Condição selecionada: ${
                        rows.find((item) => item.conditionId === activeCondition)?.supplierName ?? "—"
                      } · ${formatMoney(
                        rows.find((item) => item.conditionId === activeCondition)?.amountCents ?? 0,
                      )}`
                    : "Nenhuma condição selecionada ainda."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !activeCondition}
                  onClick={() => {
                    const row = rows.find((item) => item.conditionId === activeCondition);
                    if (!row) return;
                    const formData = new FormData();
                    formData.set("proposalId", row.proposalId);
                    formData.set("conditionId", row.conditionId);
                    run(() => approveConditionAction(formData));
                  }}
                >
                  Confirmar aprovação da condição
                </Button>
              </div>
            ) : null}

            {actionMode === "outros" ? (
              <form
                className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4"
                action={(formData) => run(() => approveOthersAction(formData))}
              >
                <p className="text-sm font-semibold text-amber-900">Finalizar fora da plataforma</p>
                <p className="text-xs text-amber-800">
                  Para negociar ou aprovar uma condição da tabela, clique nas abas acima — não é
                  preciso fechar este formulário.
                </p>
                <input type="hidden" name="quotationId" value={quotationId} />
                <input
                  name="companyName"
                  required
                  placeholder="Nome da empresa"
                  className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
                />
                <input
                  name="finalAmount"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Valor final (R$)"
                  className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
                />
                <Button type="submit" size="sm" disabled={pending}>
                  Confirmar Outros
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}

        {quotationStatus === "finalizada_outros" && otherCompanyName ? (
          <p className="mt-4 rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
            Finalizada — Outros: {otherCompanyName}
            {otherFinalAmountCents != null ? ` · ${formatMoney(otherFinalAmountCents)}` : ""}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Canal de negociação</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Único campo de mensagem. Selecione uma, várias ou todas as empresas e envie — o registro
          aparece aqui e na timeline.
        </p>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhuma mensagem ainda.</p>
          ) : (
            messages.map((item) => {
              const supplierName = rows.find((row) => row.proposalId === item.proposalId)?.supplierName;
              return (
                <div key={item.id} className="rounded-xl bg-black/[0.03] px-3 py-2 text-sm">
                  <p className="text-xs text-neutral-500">
                    {item.authorLabel}
                    {supplierName ? ` → ${supplierName}` : ""} ·{" "}
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-1 text-neutral-800">{item.body}</p>
                </div>
              );
            })
          )}
        </div>
        {canNegotiate ? (
          <div className="mt-4 space-y-2">
            <select
              value={messageTarget}
              onChange={(event) => setMessageTarget(event.target.value as "selected" | "all")}
              className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
            >
              <option value="selected">Enviar às empresas selecionadas na tabela</option>
              <option value="all">Enviar a todas as empresas</option>
            </select>
            <textarea
              value={chatBody}
              onChange={(event) => setChatBody(event.target.value)}
              rows={2}
              placeholder="Escreva uma mensagem..."
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <Button
              type="button"
              size="sm"
              disabled={pending || targetProposalIds.length === 0 || !chatBody.trim()}
              onClick={sendNegotiationMessage}
            >
              Enviar mensagem
            </Button>
          </div>
        ) : null}
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {feedback ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{feedback}</p>
      ) : null}
    </div>
  );
}
