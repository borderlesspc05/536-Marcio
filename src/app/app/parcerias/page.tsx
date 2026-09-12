import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { can, getPlanGate, parsePlanFeatures } from "@/features/billing/plan-gate";
import { PartnershipsPanel } from "@/features/partnerships/components/PartnershipsPanel";

export default async function ParceriasPage() {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.administradora],
    href: "/app/parcerias",
  });

  const gate = await getPlanGate(session.organizationId);
  if (!can(gate, "partnerships") && !can(gate, "favorites")) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-neutral-900">Parcerias</h1>
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Gestão de parcerias (com prioridade 1 no motor) é exclusiva do plano Administradora
          Premium.
        </p>
      </div>
    );
  }

  const canManage = session.role === MemberRole.master;

  const settings = await firestoreDb.platformSettings.findUnique({ where: { id: "default" } });
  const lockEnabled = settings?.partnershipLockEnabled ?? true;

  const [partnerships, suppliers, favorites, categories] = await Promise.all([
    firestoreDb.partnership.findMany({
      where: { administradoraOrgId: session.organizationId, status: "active" },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    }),
    firestoreDb.organization.findMany({
      where: { type: "fornecedor" },
      orderBy: { name: "asc" },
      include: {
        categories: { include: { category: true } },
        subscriptions: {
          where: { status: "active" },
          include: { plan: true },
          take: 1,
        },
      },
    }),
    firestoreDb.favoriteSupplier.findMany({
      where: { ownerOrgId: session.organizationId },
      include: { category: true },
    }),
    firestoreDb.serviceCategory.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const favoriteBySupplier = new Map<string, { categoryName: string | null }>(
    favorites.map((item) => [
      item.supplierOrgId,
      { categoryName: (item as { category?: { name?: string } | null }).category?.name ?? null },
    ]),
  );
  const partnerIds = new Set(partnerships.map((item) => item.supplierOrgId));

  const activePartners = partnerships.map((item) => {
    const favorite = favoriteBySupplier.get(item.supplierOrgId);
    return {
      id: item.id,
      supplierOrgId: item.supplierOrgId,
      name: item.supplier.name,
      logoUrl: (item.supplier as { logoUrl?: string | null }).logoUrl ?? null,
      categoryLabel: favorite?.categoryName ?? null,
    };
  });

  const candidates = suppliers
    .filter((supplier) => !partnerIds.has(supplier.id))
    .filter((supplier) => Boolean(supplier.subscriptions[0]))
    .map((supplier) => {
      const plan = supplier.subscriptions[0]?.plan;
      const features = parsePlanFeatures(plan?.featuresJson);
      const eligible = lockEnabled ? Boolean(features.partnershipEligible) : true;
      return {
        id: supplier.id,
        name: supplier.name,
        logoUrl: (supplier as { logoUrl?: string | null }).logoUrl ?? null,
        eligible,
        categoryNames: supplier.categories.map((link) => link.category.name),
      };
    });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Premium</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Parcerias</h1>
        <p className="mt-2 text-neutral-600">
          Vincule fornecedores parceiros. Eles entram na prioridade 1 do motor de distribuição
          (plano pago + categoria opcional). Trava Growth Loop:{" "}
          {lockEnabled ? "ativa" : "desativada"} (Master Admin).
        </p>
      </div>

      <PartnershipsPanel
        activePartners={activePartners}
        candidates={candidates}
        categories={categories}
        lockEnabled={lockEnabled}
        canManage={canManage}
      />
    </div>
  );
}
