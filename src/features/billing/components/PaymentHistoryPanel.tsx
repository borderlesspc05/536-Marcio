import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { formatPriceCents } from "@/features/billing/money";

export type PaymentHistoryItem = {
  id: string;
  monthLabel: string;
  planName: string;
  status: "Pago" | "Vencido" | "Pendente" | "Cancelado" | "Falhou";
  amountCents: number;
  paidAt: string | null;
  activateHref?: string | null;
};

type Props = {
  items: PaymentHistoryItem[];
  currentPlanSlug?: string | null;
};

const STATUS_CLASS: Record<PaymentHistoryItem["status"], string> = {
  Pago: "bg-emerald-50 text-emerald-800",
  Vencido: "bg-red-50 text-red-800",
  Pendente: "bg-amber-50 text-amber-900",
  Cancelado: "bg-neutral-100 text-neutral-600",
  Falhou: "bg-red-50 text-red-800",
};

export function PaymentHistoryPanel({ items, currentPlanSlug }: Props) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/80 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Histórico de pagamentos</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Ex.: Janeiro — Plano — Pago · Fevereiro — Plano — Vencido. Ative um ciclo de forma
            simples quando necessário.
          </p>
        </div>
        {currentPlanSlug ? (
          <Link href={`/checkout?plan=${currentPlanSlug}`}>
            <Button type="button" size="sm">
              Ativar / renovar plano
            </Button>
          </Link>
        ) : (
          <Link href="/app/meu-plano">
            <Button type="button" size="sm" variant="secondary">
              Ver planos
            </Button>
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Nenhum pagamento registrado ainda.</p>
      ) : (
        <ul className="mt-4 divide-y divide-black/5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-neutral-900">
                  {item.monthLabel} — {item.planName}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatPriceCents(item.amountCents)}
                  {item.paidAt
                    ? ` · ${new Date(item.paidAt).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[item.status]}`}
                >
                  {item.status}
                </span>
                {item.activateHref && item.status !== "Pago" ? (
                  <Link href={item.activateHref}>
                    <Button type="button" size="sm" variant="secondary">
                      Ativar
                    </Button>
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function mapCheckoutStatus(status: string): PaymentHistoryItem["status"] {
  if (status === "paid") return "Pago";
  if (status === "past_due") return "Vencido";
  if (status === "pending") return "Pendente";
  if (status === "canceled") return "Cancelado";
  if (status === "failed") return "Falhou";
  return "Pendente";
}

export function formatMonthLabel(date: Date) {
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
