import Link from "next/link";
import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { getSupplierPlanInfo } from "@/features/supplier/franchise";
import { SupplierCategoriesForm } from "@/features/supplier/components/SupplierCategoriesForm";
import {
  formatPriceCents,
  getPlanGate,
  listActivePlansForOrganization,
} from "@/features/billing/plan-gate";
import { isConsultOnlyPlan } from "@/features/billing/plan-features";
import { getActiveSubscription } from "@/features/billing/subscriptions";
import { startCategoryAddonCheckoutFormAction } from "@/features/billing/actions";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";

type PageProps = {
  searchParams: Promise<{
    activated?: string;
    current?: string;
    downgrade?: string;
    addon?: string;
    incompatible?: string;
  }>;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  past_due: "Pagamento pendente",
  pending: "Aguardando pagamento",
  canceled: "Cancelado",
  failed: "Falhou",
  paid: "Pago",
};

export default async function MeuPlanoPage({ searchParams }: PageProps) {
  const session = await requireAuthorizedSession({
    types: [
      OrganizationType.fornecedor,
      OrganizationType.sindico,
      OrganizationType.administradora,
    ],
    href: "/app/meu-plano",
  });

  const [params, gate, subscription, catalogPlans] = await Promise.all([
    searchParams,
    getPlanGate(session.organizationId),
    getActiveSubscription(session.organizationId),
    listActivePlansForOrganization(session.organizationType),
  ]);
  const notice = params.activated
    ? "Plano ativado com sucesso."
    : params.current
      ? "Este plano já está ativo na sua organização."
      : params.downgrade === "scheduled"
        ? "Mudança agendada para o fim do ciclo atual."
        : params.incompatible
          ? "O plano acessado não está disponível para este perfil."
        : params.addon === "canceled"
          ? "Contratação de categorias adicionais cancelada."
          : null;

  if (session.organizationType === OrganizationType.fornecedor) {
    const [plan, catalog, settings] = await Promise.all([
      getSupplierPlanInfo(session.organizationId),
      firestoreDb.serviceCategory.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { isActive: true, deletedAt: null },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, categoryId: true },
          },
        },
      }),
      firestoreDb.platformSettings.findUnique({ where: { id: "default" } }),
    ]);

    const addonPrice = settings?.categoryAddonPriceCents ?? 2900;
    const availableAddon = catalog.filter((item) => !plan.categoryIds.includes(item.id));
    const catalogForForm = catalog.map((category) => ({
      id: category.id,
      name: category.name,
      segments: category.items.map((item) => ({
        id: item.id,
        name: item.name,
        categoryId: item.categoryId,
      })),
    }));

    return (
      <div className="space-y-6">
        <Header
          planName={plan.planName}
          status={subscription?.status ?? "—"}
          pending={subscription?.pendingPlan?.name}
        />
        <PlanNotice message={notice} />

        <div className="grid gap-4 md:grid-cols-3">
          <Stat
            label="Cotações internas / mês"
            value={plan.franchise.isUnlimited ? "∞" : String(plan.monthlyQuota)}
            hint={`Usadas ${plan.franchise.used}${plan.franchise.isUnlimited ? "" : ` de ${plan.franchise.limit}`}`}
          />
          <Stat
            label="Categorias / segmentos"
            value={`${plan.categoriesIncluded} / ${plan.segmentsIncluded}`}
            hint={plan.allowExtraCategoriesFree ? "Liberação piloto ativa" : "Inclusos no plano"}
          />
          <Stat
            label="Valor"
            value={formatPriceCents(plan.priceCents)}
            hint={plan.isFree ? "Plano Free" : "Mensal"}
          />
        </div>

        <div className="rounded-2xl border border-black/5 bg-white/80 p-6">
          <h2 className="text-lg font-semibold text-neutral-900">Categorias e segmentos do pacote</h2>
          <div className="mt-4">
            <SupplierCategoriesForm
              categories={catalogForForm}
              initialLinks={plan.links
                .filter((l) => l.serviceItemId)
                .map((l) => ({
                  categoryId: l.categoryId,
                  serviceItemId: l.serviceItemId!,
                  contactName: l.contactName ?? "",
                  contactEmail: l.contactEmail ?? "",
                  contactPhone: l.contactPhone ?? "",
                }))}
              maxCategories={plan.categoriesIncluded}
              maxSegments={plan.segmentsIncluded}
              isFree={plan.isFree}
              allowExtraFree={plan.allowExtraCategoriesFree}
            />
          </div>
        </div>

        {!plan.isFree ? (
          <div className="rounded-2xl border border-black/5 bg-white/80 p-6">
            <h2 className="text-lg font-semibold text-neutral-900">Categorias adicionais</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Preço unitário {formatPriceCents(addonPrice)} × quantidade (checkout sandbox).
            </p>
            <ActionForm
              action={startCategoryAddonCheckoutFormAction}
              className="mt-4 space-y-3"
              submitLabel="Contratar categorias extras"
              pendingLabel="Abrindo pagamento..."
              disabled={availableAddon.length === 0}
            >
              <label className="block text-sm">
                Quantidade
                <input
                  type="number"
                  name="quantity"
                  min={1}
                  max={Math.max(availableAddon.length, 1)}
                  defaultValue={1}
                  className="mt-1 h-10 w-28 rounded-xl border border-black/10 px-3 text-sm"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {availableAddon.map((category) => (
                  <label key={category.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="categoryIds" value={category.id} />
                    {category.name}
                  </label>
                ))}
              </div>
            </ActionForm>
          </div>
        ) : null}

        <UpgradeCatalog
          plans={catalogPlans}
          currentSlug={gate?.planSlug}
          currentPriceCents={gate?.priceCents}
          pendingSlug={subscription?.pendingPlan?.slug}
          title="Upgrade de plano"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        planName={gate?.planName ?? "Sem plano"}
        status={subscription?.status ?? "—"}
        pending={subscription?.pendingPlan?.name}
      />
      <PlanNotice message={notice} />
      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          label="Franquia mensal"
          value={gate?.monthlyQuota == null ? "∞" : String(gate.monthlyQuota)}
          hint="Cotações do solicitante"
        />
        <Stat
          label="Valor"
          value={formatPriceCents(gate?.priceCents ?? 0)}
          hint="Ciclo mensal"
        />
        <Stat
          label="Status"
          value={subscription?.status ?? "—"}
          hint={subscription?.cancelAtPeriodEnd ? "Downgrade agendado" : "Assinatura"}
        />
      </div>
      <UpgradeCatalog
        plans={catalogPlans}
        currentSlug={gate?.planSlug}
        currentPriceCents={gate?.priceCents}
        pendingSlug={subscription?.pendingPlan?.slug}
        title="Planos disponíveis para o seu perfil"
        emptyHint="Nenhum plano encontrado. Rode o seed Firestore ou confira se sindico-free e sindico-pago estão ativos."
      />
      {session.organizationType === OrganizationType.sindico ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-5">
          <p className="font-semibold text-violet-950">Migrar para Administradora</p>
          <p className="mt-1 text-sm text-violet-900">
            Além dos planos de síndico acima (com checkout direto), você pode solicitar migração
            para o perfil administradora. Exige plano pago intermediário ou Premium.
          </p>
          <Link href="/app/migracao" className="mt-3 inline-block">
            <Button type="button">Solicitar migração</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Header({
  planName,
  status,
  pending,
}: {
  planName: string;
  status: string;
  pending?: string | null;
}) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Meu Plano</p>
      <h1 className="mt-1 text-3xl font-bold text-neutral-900">{planName}</h1>
      <p className="mt-2 text-neutral-600">
        Status: <span className="font-medium">{STATUS_LABELS[status] ?? status}</span>
        {pending ? ` · Downgrade pendente para ${pending}` : ""}
      </p>
    </div>
  );
}

function PlanNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
      {message}
    </p>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-neutral-900">{value}</p>
      <p className="mt-1 text-xs text-neutral-400">{hint}</p>
    </div>
  );
}

function UpgradeCatalog({
  plans,
  currentSlug,
  currentPriceCents,
  pendingSlug,
  title,
  emptyHint,
}: {
  plans: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    priceCents: number;
    isFree: boolean;
  }>;
  currentSlug?: string;
  currentPriceCents?: number;
  pendingSlug?: string | null;
  title: string;
  emptyHint?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/80 p-6">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      {plans.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-black/10 px-4 py-6 text-sm text-neutral-500">
          {emptyHint ?? "Nenhum plano disponível no momento."}
        </p>
      ) : (
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = plan.slug === currentSlug;
          const isPending = plan.slug === pendingSlug;
          const consultOnly = isConsultOnlyPlan(plan);
          const isUpgrade =
            currentPriceCents != null && plan.priceCents > currentPriceCents;
          const actionLabel = consultOnly
            ? "Falar com consultor"
            : plan.isFree
              ? currentPriceCents && currentPriceCents > 0
                ? "Agendar mudança"
                : "Ativar plano"
              : isUpgrade
                ? "Fazer upgrade"
                : "Contratar";
          return (
            <div
              key={plan.id}
              className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                isCurrent
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-black/5 bg-white hover:border-[#9333EA]/25"
              }`}
            >
              <div>
                <p className="font-semibold text-neutral-900">{plan.name}</p>
                <p className="mt-1 text-sm text-neutral-500">{plan.description}</p>
                <p className="mt-3 text-xl font-bold">
                  {consultOnly
                    ? "Sob consulta"
                    : plan.isFree
                      ? "Grátis"
                      : `${formatPriceCents(plan.priceCents)}/mês`}
                </p>
              </div>
              {isCurrent ? (
                <p className="mt-3 inline-flex w-fit rounded-lg bg-emerald-100 px-2.5 py-1.5 text-sm font-semibold text-emerald-800">
                  Plano atual
                </p>
              ) : isPending ? (
                <p className="mt-3 inline-flex w-fit rounded-lg bg-amber-100 px-2.5 py-1.5 text-sm font-semibold text-amber-800">
                  Mudança agendada
                </p>
              ) : (
                <Link href={`/checkout?plan=${plan.slug}`} className="mt-3">
                  <Button type="button" size="sm" className="w-full">
                    {actionLabel}
                  </Button>
                </Link>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
