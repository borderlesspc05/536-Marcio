import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { toggleFavoriteSupplierAction } from "@/features/favorites/actions";
import { Button } from "@/components/ui/Button";
import { can, getPlanGate } from "@/features/billing/plan-gate";

export default async function FavoritosPage() {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.administradora],
    roles: [MemberRole.master],
    href: "/app/favoritos",
  });

  const gate = await getPlanGate(session.organizationId);
  if (!can(gate, "favorites")) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-neutral-900">Favoritos</h1>
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Favoritar fornecedores é exclusivo do plano Administradora Premium. Faça upgrade para
          liberar a prioridade 1 no motor de distribuição.
        </p>
      </div>
    );
  }

  const [suppliers, favorites, categories] = await Promise.all([
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

  type FavoriteRecord = {
    supplierOrgId: string;
    category?: { name: string } | null;
  };
  const favoriteBySupplier = new Map<string, FavoriteRecord>(
    favorites.map((item) => [item.supplierOrgId, item]),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Premium</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Fornecedores favoritos</h1>
        <p className="mt-2 text-neutral-600">
          Favoritos entram na prioridade 1 do motor de distribuição (categoria + plano pago).
          Opcionalmente vincule a uma categoria específica.
        </p>
      </div>

      <div className="space-y-3">
        {suppliers.map((supplier) => {
          const favorite = favoriteBySupplier.get(supplier.id);
          const isFavorite = Boolean(favorite);
          return (
            <div
              key={supplier.id}
              className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-black/5 bg-white/80 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-neutral-900">{supplier.name}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {supplier.subscriptions[0]?.plan.name ?? "Sem plano"} ·{" "}
                  {supplier.categories.map((link) => link.category.name).join(", ") ||
                    "Sem categorias"}
                </p>
                {favorite?.category ? (
                  <p className="mt-1 text-xs font-medium text-[#9333EA]">
                    Favorito em: {favorite.category.name}
                  </p>
                ) : null}
              </div>
              <form
                className="flex flex-wrap items-end gap-2"
                action={async (formData) => {
                  "use server";
                  await toggleFavoriteSupplierAction(formData);
                }}
              >
                <input type="hidden" name="supplierOrgId" value={supplier.id} />
                {!isFavorite ? (
                  <label className="block text-xs text-neutral-600">
                    Categoria (opcional)
                    <select
                      name="categoryId"
                      className="mt-1 h-9 rounded-xl border border-black/10 bg-white px-2 text-sm"
                      defaultValue=""
                    >
                      <option value="">Todas as categorias do pacote</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <Button type="submit" size="sm" variant={isFavorite ? "secondary" : "primary"}>
                  {isFavorite ? "Remover favorito" : "Favoritar"}
                </Button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
