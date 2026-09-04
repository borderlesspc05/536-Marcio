import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { getMarketIntelligence } from "@/features/master-service/data";
import { formatPriceCents } from "@/features/billing/money";

export default async function ServiceMercadoPage() {
  await requireAuthorizedSession({
    types: [OrganizationType.master_service],
    href: "/app/service/mercado",
  });

  const market = await getMarketIntelligence();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">
          Master Service
        </p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Inteligência de mercado</h1>
        <p className="mt-2 text-neutral-600">
          Visão interna CotaCondo: região, categorias, ranking de solicitantes e médias.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <h2 className="font-semibold">Regiões (endereço)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {market.regions.map((row) => (
              <li key={row.label} className="flex justify-between gap-3">
                <span className="truncate">{row.label}</span>
                <span className="font-semibold">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <h2 className="font-semibold">Categorias</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {market.categories.map((row) => (
              <li key={row.name} className="flex justify-between gap-3">
                <span>
                  {row.name}
                  {row.avgCents != null ? (
                    <span className="block text-xs text-neutral-400">
                      média {formatPriceCents(row.avgCents)}
                    </span>
                  ) : null}
                </span>
                <span className="font-semibold">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <h2 className="font-semibold">Ranking de solicitantes</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {market.topRequesters.map((row, index) => (
              <li key={row.name} className="flex justify-between gap-3">
                <span>
                  #{index + 1} {row.name}
                </span>
                <span className="font-semibold">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
