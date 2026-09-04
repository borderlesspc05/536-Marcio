import Link from "next/link";
import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { Handshake, Receipt, TrendingUp, Wallet } from "lucide-react";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { can, getPlanGate, formatPriceCents } from "@/features/billing/plan-gate";
import {
  createCommissionAgreementFormAction,
  deleteCommissionAgreementFormAction,
  updateCommissionAgreementFormAction,
} from "@/features/commissions/actions";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";

type PageProps = {
  searchParams: Promise<{
    supplierOrgId?: string;
    yearMonth?: string;
    categoryId?: string;
  }>;
};

const ENTRY_STATUS: Record<string, { label: string; className: string }> = {
  expected: {
    label: "Esperada",
    className: "bg-amber-50 text-amber-800",
  },
  accrued: {
    label: "Apropriada",
    className: "bg-sky-50 text-sky-800",
  },
  paid: {
    label: "Paga",
    className: "bg-emerald-50 text-emerald-800",
  },
  canceled: {
    label: "Cancelada",
    className: "bg-neutral-100 text-neutral-600",
  },
};

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatYearMonth(value: string) {
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(Number(year), Number(month) - 1, 1),
  );
}

export default async function FinanceiroPage({ searchParams }: PageProps) {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.administradora],
    roles: [MemberRole.master],
    href: "/app/financeiro",
  });

  const [filters, gate] = await Promise.all([
    searchParams,
    getPlanGate(session.organizationId),
  ]);

  if (!can(gate, "commissions")) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">
            Financeiro
          </p>
          <h1 className="mt-1 text-3xl font-bold text-neutral-900">Comissões e receita</h1>
          <p className="mt-2 text-neutral-600">
            Acompanhe acordos com fornecedores e o extrato gerado após a aprovação das cotações.
          </p>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-semibold text-amber-950">Recurso do plano Administradora Premium</p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Sua organização está no plano <strong>{gate?.planName ?? "sem plano ativo"}</strong>.
            A gestão de comissões libera o extrato por fornecedor, acordos percentuais ou fixos e
            o acompanhamento da receita esperada no mês.
          </p>
          <Link href="/app/meu-plano" className="mt-4 inline-block">
            <Button type="button" size="sm">
              Conferir meu plano
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const yearMonth = filters.yearMonth?.trim() || currentYearMonth();

  const [agreements, entries, partners, categories] = await Promise.all([
    firestoreDb.commissionAgreement.findMany({
      where: { administradoraOrgId: session.organizationId },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    }),
    firestoreDb.commissionEntry.findMany({
      where: {
        administradoraOrgId: session.organizationId,
        yearMonth,
        ...(filters.supplierOrgId ? { supplierOrgId: filters.supplierOrgId } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    }),
    firestoreDb.partnership.findMany({
      where: { administradoraOrgId: session.organizationId, status: "active" },
      include: { supplier: true },
    }),
    firestoreDb.serviceCategory.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const categoryNames = new Map<string, string>(
    categories.map((item) => [item.id, item.name]),
  );
  const totalExpected = entries
    .filter((item) => item.status !== "canceled")
    .reduce((sum, item) => sum + item.commissionCents, 0);
  const totalVolume = entries
    .filter((item) => item.status !== "canceled")
    .reduce((sum, item) => sum + item.volumeCents, 0);
  const paidTotal = entries
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + item.commissionCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">
          Master · Financeiro
        </p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Comissões e receita</h1>
        <p className="mt-2 max-w-3xl text-neutral-600">
          Extrato do mês, acordos com fornecedores parceiros e expectativa de receita após a
          aprovação das cotações. A equipe operacional não acessa esta área.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label={`Expectativa · ${formatYearMonth(yearMonth)}`}
          value={formatPriceCents(totalExpected)}
        />
        <StatCard
          icon={TrendingUp}
          label="Volume aprovado"
          value={formatPriceCents(totalVolume)}
        />
        <StatCard
          icon={Receipt}
          label="Já recebido"
          value={formatPriceCents(paidTotal)}
        />
        <StatCard
          icon={Handshake}
          label="Acordos ativos"
          value={String(agreements.length)}
          hint={`${partners.length} fornecedor${partners.length === 1 ? "" : "es"} parceiro${partners.length === 1 ? "" : "s"}`}
        />
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-black/5 bg-white/80 p-4"
      >
        <label className="text-sm">
          Competência
          <input
            name="yearMonth"
            defaultValue={yearMonth}
            placeholder="AAAA-MM"
            className="mt-1 h-10 w-36 rounded-xl border border-black/10 px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          Fornecedor
          <select
            name="supplierOrgId"
            defaultValue={filters.supplierOrgId ?? ""}
            className="mt-1 h-10 min-w-48 rounded-xl border border-black/10 px-3 text-sm"
          >
            <option value="">Todos fornecedores</option>
            {partners.map((item) => (
              <option key={item.supplierOrgId} value={item.supplierOrgId}>
                {item.supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Categoria
          <select
            name="categoryId"
            defaultValue={filters.categoryId ?? ""}
            className="mt-1 h-10 min-w-48 rounded-xl border border-black/10 px-3 text-sm"
          >
            <option value="">Todas categorias</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
      </form>

      <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold text-neutral-900">Extrato do período</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Lançamentos gerados automaticamente quando uma cotação é aprovada.
        </p>
        {entries.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-neutral-500">
            Sem lançamentos nesta competência. Aprove uma cotação com acordo de comissão para
            popular o extrato.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-neutral-400">
                  <th className="py-2 pr-3 font-medium">Fornecedor</th>
                  <th className="py-2 pr-3 font-medium">Categoria</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Volume</th>
                  <th className="py-2 font-medium">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const status = ENTRY_STATUS[entry.status] ?? ENTRY_STATUS.expected;
                  return (
                    <tr key={entry.id} className="border-b border-black/5 last:border-0">
                      <td className="py-3 pr-3 font-medium text-neutral-900">
                        {entry.supplier.name}
                      </td>
                      <td className="py-3 pr-3 text-neutral-600">
                        {entry.categoryId
                          ? (categoryNames.get(entry.categoryId) ?? "Categoria")
                          : "—"}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-neutral-700">
                        {formatPriceCents(entry.volumeCents)}
                      </td>
                      <td className="py-3 font-semibold text-neutral-900">
                        {formatPriceCents(entry.commissionCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <h2 className="font-semibold text-neutral-900">Novo acordo de comissão</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Defina percentual ou valor fixo sobre as cotações aprovadas daquele fornecedor.
          </p>
          {partners.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-black/10 px-4 py-6 text-sm text-neutral-600">
              Cadastre um fornecedor em{" "}
              <Link href="/app/parcerias" className="font-medium text-[#9333EA] hover:underline">
                Parcerias
              </Link>{" "}
              antes de criar o acordo.
            </div>
          ) : (
            <ActionForm
              action={createCommissionAgreementFormAction}
              className="mt-4 grid gap-3 md:grid-cols-2"
              submitLabel="Cadastrar acordo"
              pendingLabel="Salvando..."
            >
              <label className="text-sm">
                Fornecedor
                <select
                  name="supplierOrgId"
                  required
                  className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
                >
                  <option value="">Selecione</option>
                  {partners.map((item) => (
                    <option key={item.supplierOrgId} value={item.supplierOrgId}>
                      {item.supplier.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Tipo
                <select
                  name="feeType"
                  className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
                >
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Fixo (R$)</option>
                </select>
              </label>
              <label className="text-sm">
                Valor
                <input
                  name="feeValue"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
                />
              </label>
              <label className="text-sm">
                Duração (meses, 1–12)
                <input
                  name="durationMonths"
                  type="number"
                  min={1}
                  max={12}
                  className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
                />
              </label>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" name="isRecurring" />
                Recorrente
              </label>
              <label className="text-sm md:col-span-2">
                Notas
                <input
                  name="notes"
                  className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
                />
              </label>
            </ActionForm>
          )}
        </section>

        <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <h2 className="font-semibold text-neutral-900">Acordos cadastrados</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Ajuste percentual ou valor quando a negociação mudar.
          </p>
          <div className="mt-4 space-y-3">
            {agreements.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-neutral-500">
                Nenhum acordo ainda. Use o formulário ao lado para cadastrar o primeiro.
              </p>
            ) : (
              agreements.map((item) => (
                <div
                  key={item.id}
                  className="space-y-2 rounded-2xl border border-black/5 p-3"
                >
                <ActionForm
                  action={updateCommissionAgreementFormAction}
                  className="grid gap-2 md:grid-cols-[1.2fr_0.7fr_0.7fr]"
                  submitLabel="Salvar"
                  pendingLabel="Salvando..."
                  size="sm"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <div>
                    <p className="font-medium text-neutral-900">{item.supplier.name}</p>
                    <p className="text-xs text-neutral-500">
                      {item.isRecurring
                        ? "Recorrente"
                        : item.durationMonths
                          ? `${item.durationMonths} meses`
                          : "Vigente"}
                    </p>
                  </div>
                  <select
                    name="feeType"
                    defaultValue={item.feeType}
                    className="h-10 rounded-xl border border-black/10 px-2 text-sm"
                  >
                    <option value="percent">%</option>
                    <option value="fixed">R$ fixo</option>
                  </select>
                  <input
                    name="feeValue"
                    type="number"
                    step="0.01"
                    min="0.01"
                    defaultValue={item.feeValue}
                    className="h-10 rounded-xl border border-black/10 px-2 text-sm"
                  />
                </ActionForm>
                <ActionForm
                  action={deleteCommissionAgreementFormAction}
                  className="flex justify-end"
                  submitLabel="Excluir acordo"
                  pendingLabel="Excluindo..."
                  size="sm"
                  variant="secondary"
                >
                  <input type="hidden" name="id" value={item.id} />
                </ActionForm>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
      <div className="flex items-center gap-2 text-neutral-500">
        <Icon className="h-4 w-4" />
        <p className="text-sm">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-neutral-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-400">{hint}</p> : null}
    </div>
  );
}
