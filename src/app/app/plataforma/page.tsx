import Link from "next/link";
import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { Button } from "@/components/ui/Button";
import { togglePartnershipLockAction } from "@/features/partnerships/actions";
import { reviewMigrationAction } from "@/features/migration/actions";
import {
  createCustomBillingCheckoutAction,
  deletePlanOverrideAction,
  updatePlatformSettingsAction,
  upsertPlanOverrideAction,
} from "@/features/platform/actions";
import { getPlatformReports } from "@/features/platform/reports";
import { formatPriceCents } from "@/features/billing/money";
import { formAction } from "@/lib/form-action";

export default async function Page() {
  await requireAuthorizedSession({
    types: [OrganizationType.master_admin],
    href: "/app/plataforma",
  });

  const [settings, migrations, overrides, orgs, reports] = await Promise.all([
    firestoreDb.platformSettings.findUnique({ where: { id: "default" } }),
    firestoreDb.organizationMigration.findMany({
      where: { status: { in: ["pending_payment", "pending_review", "approved"] } },
      include: {
        targetPlan: true,
        organization: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    firestoreDb.planOverride.findMany({
      include: { organization: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    firestoreDb.organization.findMany({
      where: { type: { in: ["sindico", "administradora", "fornecedor"] } },
      orderBy: { name: "asc" },
      take: 100,
    }),
    getPlatformReports(),
  ]);

  let reminderDays = "5,10";
  try {
    const parsed = JSON.parse(settings?.reminderDaysJson || "[5,10]") as number[];
    if (Array.isArray(parsed)) reminderDays = parsed.join(",");
  } catch {
    reminderDays = "5,10";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Master Admin</p>
          <h1 className="mt-1 text-3xl font-bold text-neutral-900">Painel da plataforma</h1>
          <p className="mt-2 text-neutral-600">
            Parametrização, overrides, relatórios, catálogo, compliance e migrações.
          </p>
        </div>
        <Link href="/app/plataforma/catalogo">
          <Button>Abrir catálogo</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { label: "CRUD de categorias e serviços", href: "/app/plataforma/catalogo" },
          { label: "Fila de compliance", href: "/app/plataforma/compliance" },
          { label: "Banners, WhatsApp, Blog e pixels", href: "/app/plataforma/banners" },
          { label: "Migrações", href: "/app/plataforma/migracoes" },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-2xl border border-black/5 bg-white/80 p-5 text-sm font-medium hover:border-[#9333EA]/30"
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Parametrização global</h2>
        <form action={formAction(updatePlatformSettingsAction)} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Franquia Free solicitante
            <input
              name="freeQuotaSolicitante"
              type="number"
              min={0}
              defaultValue={settings?.freeQuotaSolicitante ?? 15}
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Franquia Free fornecedor
            <input
              name="freeQuotaFornecedor"
              type="number"
              min={0}
              defaultValue={settings?.freeQuotaFornecedor ?? 1}
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Limite Pro fornecedor (XX)
            <input
              name="supplierProQuota"
              type="number"
              min={0}
              defaultValue={settings?.supplierProQuota ?? 30}
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Limite Premium fornecedor (YY)
            <input
              name="supplierPremiumQuota"
              type="number"
              min={0}
              defaultValue={settings?.supplierPremiumQuota ?? 100}
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Preço categoria adicional (R$)
            <input
              name="categoryAddonPrice"
              type="number"
              step="0.01"
              min={0}
              defaultValue={((settings?.categoryAddonPriceCents ?? 2900) / 100).toFixed(2)}
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Prazos de lembrete (dias, vírgula)
            <input
              name="reminderDays"
              defaultValue={reminderDays}
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              name="partnershipLockEnabled"
              defaultChecked={settings?.partnershipLockEnabled ?? true}
            />
            Trava Growth Loop (parceria só Intermediário+)
          </label>
          <Button type="submit">Salvar parâmetros</Button>
        </form>
        <form action={formAction(togglePartnershipLockAction)} className="mt-3">
          <input type="hidden" name="enabled" value={settings?.partnershipLockEnabled ? "false" : "true"} />
          <Button type="submit" size="sm" variant="secondary">
            Atalho: {settings?.partnershipLockEnabled ? "Desativar trava" : "Ativar trava"}
          </Button>
        </form>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Override de franquia por cliente</h2>
        <form action={formAction(upsertPlanOverrideAction)} className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm md:col-span-2">
            Organização
            <select name="organizationId" required className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3">
              <option value="">Selecione</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.type})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Franquia mensal
            <input
              name="monthlyQuota"
              type="number"
              min={0}
              placeholder="ex.: 50"
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Categorias inclusas (override)
            <input
              name="categoriesIncluded"
              type="number"
              min={1}
              placeholder="ex.: 3"
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Segmentos inclusos (override)
            <input
              name="segmentsIncluded"
              type="number"
              min={1}
              placeholder="ex.: 3"
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-3">
            <input type="checkbox" name="allowExtraCategoriesFree" />
            Liberação piloto: categorias/segmentos extras sem cobrança
          </label>
          <label className="text-sm md:col-span-3">
            Notas
            <input name="notes" className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3" />
          </label>
          <Button type="submit">Salvar override</Button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {overrides.length === 0 ? (
            <li className="text-neutral-500">Nenhum override.</li>
          ) : (
            overrides.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/5 px-3 py-2">
                <span>
                  {item.organization.name} · franquia {item.monthlyQuota ?? "ilimitada"}
                  {item.notes ? ` · ${item.notes}` : ""}
                </span>
                <form action={formAction(deletePlanOverrideAction)}>
                  <input type="hidden" name="organizationId" value={item.organizationId} />
                  <Button type="submit" size="sm" variant="secondary">
                    Remover
                  </Button>
                </form>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Faturar adicional / plano personalizado (VIP)</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Gera checkout automático com valor livre (banner patrocinado, campanhas etc.) sem alterar
          features do produto.
        </p>
        <form
          action={formAction(createCustomBillingCheckoutAction)}
          className="mt-4 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm md:col-span-2">
            Organização
            <select
              name="organizationId"
              required
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            >
              <option value="">Selecione</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.type})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Valor (R$)
            <input
              name="amountReais"
              type="number"
              min={1}
              step="0.01"
              required
              placeholder="ex.: 1500"
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Descrição do adicional
            <input
              name="description"
              required
              placeholder="ex.: Banner Patrocinado — Abril"
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Plano de referência
            <select name="planSlug" className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3">
              <option value="fornecedor-vip">Plano VIP</option>
              <option value="fornecedor-premium">Condo Premium</option>
              <option value="fornecedor-pro">Condo Basic</option>
            </select>
          </label>
          <Button type="submit" className="md:col-span-3">
            Gerar checkout
          </Button>
        </form>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Relatórios globais (v1)</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-black/5 p-3">
            <p className="text-xs text-neutral-500">Indicações Free</p>
            <p className="mt-1 text-2xl font-bold">{reports.referralsFree}</p>
          </div>
          <div className="rounded-xl border border-black/5 p-3">
            <p className="text-xs text-neutral-500">Indicações ativas (pago)</p>
            <p className="mt-1 text-2xl font-bold">{reports.referralsActivePaid}</p>
          </div>
          <div className="rounded-xl border border-black/5 p-3">
            <p className="text-xs text-neutral-500">Volume transacionado</p>
            <p className="mt-1 text-2xl font-bold">{formatPriceCents(reports.commissionVolumeCents)}</p>
          </div>
          <div className="rounded-xl border border-black/5 p-3">
            <p className="text-xs text-neutral-500">Cotações Outros / Aprovadas</p>
            <p className="mt-1 text-2xl font-bold">
              {reports.quotationsOutros} / {reports.quotationsApproved}
            </p>
          </div>
        </div>
        <h3 className="mt-5 text-sm font-semibold">Conversão de planos (assinaturas ativas)</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {reports.planConversion.map((item) => (
            <li key={item.slug} className="flex justify-between rounded-lg border border-black/5 px-3 py-1.5">
              <span>
                {item.name} {item.isFree ? "(Free)" : ""}
              </span>
              <span className="font-semibold">{item.count}</span>
            </li>
          ))}
        </ul>
        <h3 className="mt-5 text-sm font-semibold">Inteligência de cotações (v1)</h3>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-black/5 p-3 text-sm">
            <p className="font-medium">Serviços mais solicitados</p>
            <ul className="mt-2 space-y-1">
              {reports.topServices.map((item) => (
                <li key={item.serviceItemId} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="font-semibold">{item.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-black/5 p-3 text-sm">
            <p className="font-medium">Média de preço por segmento</p>
            <ul className="mt-2 space-y-1">
              {reports.avgPriceByService.map((item) => (
                <li key={item.serviceItemId} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="font-semibold">{formatPriceCents(item.avgCents)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-neutral-500">
              Prazo médio aceite:{" "}
              {reports.avgAcceptHours != null ? `${reports.avgAcceptHours.toFixed(1)}h` : "—"} ·
              proposta:{" "}
              {reports.avgProposalHours != null ? `${reports.avgProposalHours.toFixed(1)}h` : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Migrações recentes</h2>
          <Link href="/app/plataforma/migracoes" className="text-sm text-[#9333EA]">
            Ver todas
          </Link>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {migrations.length === 0 ? (
            <li className="text-neutral-500">Nenhuma migração.</li>
          ) : (
            migrations.map((item) => (
              <li key={item.id} className="rounded-xl border border-black/5 px-3 py-2">
                {item.organization.name} → {item.targetPlan.name} · {item.status}
                {item.status === "pending_review" ? (
                  <form action={formAction(reviewMigrationAction)} className="mt-2 flex gap-2">
                    <input type="hidden" name="migrationId" value={item.id} />
                    <Button type="submit" name="decision" value="approve" size="sm">
                      Aprovar
                    </Button>
                    <Button type="submit" name="decision" value="reject" size="sm" variant="secondary">
                      Rejeitar
                    </Button>
                  </form>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
