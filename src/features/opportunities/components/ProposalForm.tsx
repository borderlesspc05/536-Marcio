"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  evaluateProposalPriceAction,
  submitProposalAction,
} from "@/features/opportunities/actions";

type Props = {
  inviteId: string;
  canSubmit: boolean;
  blockMessage?: string;
};

type PaymentMode = "a_vista" | "parcelado";

type ConditionDraft = {
  amount: string;
  paymentMode: PaymentMode;
  installments: number;
  fileName: string;
};

function buildPaymentTerms(condition: ConditionDraft): string {
  if (condition.paymentMode === "a_vista") return "À vista";
  const n = Math.max(1, Math.min(48, Number(condition.installments) || 1));
  return `${n}x`;
}

function AttachmentField({
  index,
  fileName,
  onFileChange,
}: {
  index: number;
  fileName: string;
  onFileChange: (file: File | null) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name={`attachment_${index}`}
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="sr-only"
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-2"
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="h-4 w-4" aria-hidden />
        Anexar arquivo
      </Button>
      <span className="text-xs text-neutral-500">
        {fileName || "Nenhum arquivo selecionado (PDF ou imagem)"}
      </span>
    </div>
  );
}

export function ProposalForm({ inviteId, canSubmit, blockMessage }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [priceHint, setPriceHint] = useState<string | null>(null);
  const [conditions, setConditions] = useState<ConditionDraft[]>([
    { amount: "", paymentMode: "a_vista", installments: 2, fileName: "" },
  ]);

  function updateCondition(index: number, patch: Partial<ConditionDraft>) {
    setConditions((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function evaluatePrice(index: number) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("inviteId", inviteId);
      formData.set("amount", conditions[index]?.amount ?? "");
      const result = await evaluateProposalPriceAction(formData);
      if (!result.ok) {
        setPriceHint(null);
        setError(result.message ?? "Erro ao avaliar");
        return;
      }
      setError(null);
      if (result.evaluation) {
        const ev = result.evaluation;
        setPriceHint(
          `Condição ${index + 1}: ${ev.percentDelta >= 0 ? "+" : ""}${ev.percentDelta}% vs média (R$ ${(ev.averageCents / 100).toFixed(2)}) — ${ev.position.toUpperCase()} · amostra ${ev.sampleSize} (${ev.source === "quotation" ? "desta cotação" : "histórico do segmento"})`,
        );
      } else {
        setPriceHint(result.message ?? "Sem base de comparação.");
      }
    });
  }

  if (!canSubmit) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {blockMessage ?? "Envio bloqueado pelo plano ou compliance."}
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-2xl border border-black/5 bg-white/80 p-5"
      action={(formData) => {
        startTransition(async () => {
          for (let index = 0; index < conditions.length; index += 1) {
            formData.set(`paymentTerms_${index}`, buildPaymentTerms(conditions[index]!));
          }
          const result = await submitProposalAction(formData);
          if (!result.ok) {
            setError(result.message ?? "Erro ao enviar");
            setMessage(null);
            return;
          }
          setError(null);
          setMessage(result.message ?? "Enviada");
          router.refresh();
        });
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-neutral-900">Enviar proposta</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            setConditions((prev) => [
              ...prev,
              { amount: "", paymentMode: "a_vista", installments: 2, fileName: "" },
            ])
          }
        >
          + Condição
        </Button>
      </div>
      <input type="hidden" name="inviteId" value={inviteId} />
      <input type="hidden" name="conditionCount" value={conditions.length} />

      <div className="space-y-3">
        {conditions.map((condition, index) => (
          <div key={index} className="space-y-2 rounded-xl border border-black/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Condição {index + 1}
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                name={`amount_${index}`}
                required={index === 0}
                type="number"
                min="0.01"
                step="0.01"
                value={condition.amount}
                onChange={(e) => updateCondition(index, { amount: e.target.value })}
                placeholder="Valor (R$)"
                className="h-11 min-w-[140px] flex-1 rounded-xl border border-black/10 px-3 text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending || !condition.amount}
                onClick={() => evaluatePrice(index)}
              >
                Avaliar preço
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-neutral-600">Condição de pagamento</p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={condition.paymentMode}
                  onChange={(e) =>
                    updateCondition(index, {
                      paymentMode: e.target.value as PaymentMode,
                    })
                  }
                  className="h-11 min-w-[160px] rounded-xl border border-black/10 px-3 text-sm"
                  aria-label="Modo de pagamento"
                >
                  <option value="a_vista">À vista</option>
                  <option value="parcelado">Parcelado</option>
                </select>
                {condition.paymentMode === "parcelado" ? (
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <span className="text-xs text-neutral-500">Parcelas</span>
                    <input
                      type="number"
                      min={1}
                      max={48}
                      step={1}
                      value={condition.installments}
                      onChange={(e) =>
                        updateCondition(index, {
                          installments: Math.max(1, Math.min(48, Number(e.target.value) || 1)),
                        })
                      }
                      className="h-11 w-24 rounded-xl border border-black/10 px-3 text-sm"
                      aria-label="Quantidade de parcelas"
                    />
                  </label>
                ) : null}
              </div>
              <p className="text-xs text-neutral-500">
                Opções fechadas: à vista ou quantidade de parcelas (digite ou use as setas).
                {condition.paymentMode === "parcelado"
                  ? ` Será enviado como “${buildPaymentTerms(condition)}”.`
                  : ""}
              </p>
              <input type="hidden" name={`paymentTerms_${index}`} value={buildPaymentTerms(condition)} />
            </div>
            <AttachmentField
              index={index}
              fileName={condition.fileName}
              onFileChange={(file) =>
                updateCondition(index, { fileName: file?.name ?? "" })
              }
            />
            {conditions.length > 1 ? (
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                onClick={() =>
                  setConditions((prev) => prev.filter((_, i) => i !== index))
                }
              >
                Remover condição
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {priceHint ? (
        <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">{priceHint}</p>
      ) : null}
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar proposta"}
      </Button>
    </form>
  );
}
