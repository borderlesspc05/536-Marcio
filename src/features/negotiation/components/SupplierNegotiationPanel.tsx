"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  sendNegotiationMessageAction,
  updateProposalDuringNegotiationAction,
} from "@/features/negotiation/actions";

type Message = {
  id: string;
  body: string;
  authorLabel: string;
  createdAt: string;
};

type Props = {
  proposalId: string;
  messages?: Message[];
  canChat?: boolean;
};

export function SupplierNegotiationPanel({
  proposalId,
  messages = [],
  canChat = true,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount1, setAmount1] = useState("");
  const [terms1, setTerms1] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3 rounded-xl border border-[#9333EA]/20 bg-[#9333EA]/5 p-4">
      <p className="text-sm font-semibold text-neutral-900">Canal de negociação</p>

      <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl bg-white/70 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma mensagem ainda.</p>
        ) : (
          messages.map((item) => (
            <div key={item.id} className="rounded-lg bg-black/[0.03] px-3 py-2 text-sm">
              <p className="text-xs text-neutral-500">
                {item.authorLabel} · {new Date(item.createdAt).toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-neutral-800">{item.body}</p>
            </div>
          ))
        )}
      </div>

      {canChat ? (
        <>
          <p className="text-sm font-semibold text-neutral-900">Responder / atualizar proposta</p>
          <form
            className="space-y-2"
            action={(formData) => {
              startTransition(async () => {
                const result = await updateProposalDuringNegotiationAction(formData);
                if (!result.ok) {
                  setError(result.message ?? "Erro");
                  return;
                }
                setError(null);
                setFeedback(result.message ?? "Atualizado");
                router.refresh();
              });
            }}
          >
            <input type="hidden" name="proposalId" value={proposalId} />
            <input type="hidden" name="conditionCount" value="1" />
            <input
              name="amount_0"
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount1}
              onChange={(e) => setAmount1(e.target.value)}
              placeholder="Novo valor (R$)"
              className="h-10 w-full rounded-xl border border-black/10 px-3 text-sm"
            />
            <input
              name="paymentTerms_0"
              required
              value={terms1}
              onChange={(e) => setTerms1(e.target.value)}
              placeholder="Nova condição de pagamento"
              className="h-10 w-full rounded-xl border border-black/10 px-3 text-sm"
            />
            <Button type="submit" size="sm" disabled={pending}>
              Atualizar condições
            </Button>
          </form>
          <form
            className="space-y-2"
            action={(formData) => {
              startTransition(async () => {
                const result = await sendNegotiationMessageAction(formData);
                if (!result.ok) {
                  setError(result.message ?? "Erro");
                  return;
                }
                setError(null);
                setFeedback(result.message ?? "Enviado");
                setMessage("");
                router.refresh();
              });
            }}
          >
            <input type="hidden" name="proposalId" value={proposalId} />
            <textarea
              name="body"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Mensagem ao solicitante"
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              Enviar mensagem
            </Button>
          </form>
        </>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {feedback ? <p className="text-xs text-emerald-700">{feedback}</p> : null}
    </div>
  );
}
