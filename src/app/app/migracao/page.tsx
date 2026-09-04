import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { MigrationForm } from "@/features/migration/components/MigrationForm";

export default async function MigracaoPage() {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.sindico],
    href: "/app/migracao",
  });

  const [plans, history] = await Promise.all([
    firestoreDb.plan.findMany({
      where: {
        isActive: true,
        slug: { in: ["adm-free", "adm-pago", "adm-premium"] },
      },
      orderBy: { sortOrder: "asc" },
    }),
    firestoreDb.organizationMigration.findMany({
      where: { organizationId: session.organizationId },
      include: { targetPlan: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Migração</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Síndico → Administradora</h1>
        <p className="mt-2 text-neutral-600">
          Seus condomínios, cotações, propostas e documentos permanecem na mesma organização.
          É obrigatório contratar plano pago intermediário ou Premium.
        </p>
      </div>

      <MigrationForm
        plans={plans.map((plan) => ({
          slug: plan.slug,
          name: plan.name,
          description: plan.description,
          priceCents: plan.priceCents,
          isFree: plan.isFree,
        }))}
      />

      {history.length > 0 ? (
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <h2 className="font-semibold">Histórico</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-600">
            {history.map((item) => (
              <li key={item.id}>
                {item.targetPlan.name} · {item.status} ·{" "}
                {item.createdAt.toLocaleString("pt-BR")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
