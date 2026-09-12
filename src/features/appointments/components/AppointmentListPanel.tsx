"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deleteServiceAppointmentAction } from "@/features/appointments/actions";
import { formatBrDate } from "@/features/appointments/filters";
import { formatPriceCents } from "@/features/billing/money";
import { formAction } from "@/lib/form-action";

type AppointmentRow = {
  id: string;
  appointmentDate: string;
  leadMode: string;
  source: string;
  notes: string | null;
  condominium: { name: string };
  category: { name: string };
  serviceItem: { name: string } | null;
  externalApproval: {
    reason: string;
    approvedAt: string;
    approvedBy: { name: string };
    proposal: {
      organization: { name: string };
      conditions: Array<{ amountCents: number; paymentTerms: string }>;
    } | null;
  } | null;
};

type Props = {
  appointments: AppointmentRow[];
  upcoming?: AppointmentRow[];
  canManage?: boolean;
};

const LEAD_LABELS: Record<string, string> = {
  exact_date: "Dia exato na agenda",
  days_15: "15 dias antes",
  days_30: "30 dias antes",
  days_60: "60 dias antes",
  days_90: "90 dias antes",
};

export function AppointmentListPanel({
  appointments,
  upcoming = [],
  canManage = true,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = appointments.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Próximos vencimentos</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Os 10 vencimentos mais próximos. Clique para ver detalhes e observações.
        </p>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Nenhum vencimento próximo no filtro atual.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {upcoming.map((row) => (
              <li key={`upcoming-${row.id}`}>
                <button
                  type="button"
                  className={`flex w-full flex-wrap items-center justify-between gap-2 px-1 py-3 text-left text-sm hover:bg-black/[0.02] ${
                    selectedId === row.id ? "bg-fuchsia-50/60" : ""
                  }`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <span className="font-medium">{formatBrDate(new Date(row.appointmentDate))}</span>
                  <span className="text-neutral-700">{row.condominium.name}</span>
                  <span className="text-neutral-500">
                    {row.category.name}
                    {row.serviceItem ? ` · ${row.serviceItem.name}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/80 lg:col-span-3">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 bg-black/[0.02] text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Condomínio</th>
                <th className="px-4 py-3 font-medium">Serviço</th>
                <th className="px-4 py-3 font-medium">Origem</th>
              </tr>
            </thead>
            <tbody>
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                    Nenhum compromisso encontrado.
                  </td>
                </tr>
              ) : (
                appointments.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer border-b border-black/5 last:border-0 hover:bg-black/[0.02] ${selectedId === row.id ? "bg-fuchsia-50/50" : ""}`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td className="px-4 py-3 font-medium">
                      {formatBrDate(new Date(row.appointmentDate))}
                    </td>
                    <td className="px-4 py-3">{row.condominium.name}</td>
                    <td className="px-4 py-3">
                      {row.category.name}
                      {row.serviceItem ? ` · ${row.serviceItem.name}` : ""}
                    </td>
                    <td className="px-4 py-3 capitalize">{row.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white/80 p-5 lg:col-span-2">
          <h2 className="font-semibold">Detalhes e histórico</h2>
          {!selected ? (
            <p className="mt-3 text-sm text-neutral-500">
              Selecione um compromisso para ver detalhes, observações e a última aprovação vinculada.
            </p>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              <p>
                <span className="text-neutral-500">Disparo:</span>{" "}
                {LEAD_LABELS[selected.leadMode] ?? selected.leadMode}
              </p>
              <div className="rounded-xl bg-neutral-50 p-3">
                <p className="font-medium">Observações</p>
                <p className="mt-1 whitespace-pre-wrap text-neutral-600">
                  {selected.notes?.trim() ? selected.notes : "Nenhuma observação registrada."}
                </p>
              </div>
              {selected.externalApproval ? (
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-medium">Última aprovação via plataforma</p>
                  <p className="mt-1 text-neutral-600">{selected.externalApproval.reason}</p>
                  <p className="mt-2 text-xs text-neutral-500">
                    Por {selected.externalApproval.approvedBy.name} em{" "}
                    {new Date(selected.externalApproval.approvedAt).toLocaleString("pt-BR")}
                  </p>
                  {selected.externalApproval.proposal ? (
                    <p className="mt-2">
                      Vencedor: {selected.externalApproval.proposal.organization.name} —{" "}
                      {selected.externalApproval.proposal.conditions[0]
                        ? formatPriceCents(
                            selected.externalApproval.proposal.conditions[0].amountCents,
                          )
                        : "—"}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-neutral-500">Compromisso cadastrado manualmente.</p>
              )}

              {canManage ? (
                <form
                  action={(formData) => {
                    startTransition(async () => {
                      formData.set("id", selected.id);
                      await formAction(deleteServiceAppointmentAction)(formData);
                      setSelectedId(null);
                      router.refresh();
                    });
                  }}
                >
                  <Button type="submit" variant="secondary" disabled={pending}>
                    Excluir compromisso
                  </Button>
                </form>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
