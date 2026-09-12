"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  externalApproveQuotationAction,
  externalRejectQuotationAction,
} from "@/features/external-approver/actions";

type Props = {
  quotationId: string;
  mode?: "approve" | "reject";
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary";
};

export function ExternalApprovalModal({
  quotationId,
  mode = "approve",
  triggerLabel,
  triggerVariant = "primary",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notApplicable, setNotApplicable] = useState(false);

  const isApprove = mode === "approve";
  const label = triggerLabel ?? (isApprove ? "Aprovar" : "Recusar");

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant === "secondary" ? "secondary" : undefined}
        onClick={() => {
          setError(null);
          setSuccess(null);
          setOpen(true);
        }}
      >
        {label}
      </Button>

      {success ? (
        <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-neutral-900">
              {isApprove ? "Confirmar aprovação" : "Confirmar recusa"}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {isApprove
                ? "Informe o motivo e a data da próxima contratação (quando aplicável)."
                : "Informe o motivo da recusa para registro e notificação."}
            </p>

            <form
              className="mt-5 space-y-4"
              action={(formData) => {
                startTransition(async () => {
                  formData.set("quotationId", quotationId);
                  const result = isApprove
                    ? await externalApproveQuotationAction(formData)
                    : await externalRejectQuotationAction(formData);
                  if (!result.ok) {
                    setError(result.message ?? "Não foi possível concluir.");
                    return;
                  }
                  setOpen(false);
                  setSuccess(result.message ?? "Salvo com sucesso.");
                  const tab = isApprove ? "aprovadas" : "recusadas";
                  router.push(`/app/aprovador/cotacoes?tab=${tab}`);
                  router.refresh();
                });
              }}
            >
              <label className="block text-sm">
                Motivo {isApprove ? "da aprovação" : "da recusa"} *
                <textarea
                  name="reason"
                  required
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
                  placeholder="Descreva a justificativa..."
                />
              </label>

              {isApprove ? (
                <>
                  <label className="block text-sm">
                    Data da próxima contratação
                    <input
                      name="nextContractDate"
                      type="date"
                      disabled={notApplicable}
                      className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3 text-sm disabled:bg-neutral-100"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="nextContractNotApplicable"
                      checked={notApplicable}
                      onChange={(event) => setNotApplicable(event.target.checked)}
                    />
                    Não se aplica
                  </label>
                </>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Salvando..." : "Confirmar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
