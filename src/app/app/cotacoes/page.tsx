import Link from "next/link";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { getFranchiseBalance } from "@/features/quotations/franchise";
import { Button } from "@/components/ui/Button";
import type { QuotationStatus } from "@/lib/domain/types";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    categoryId?: string;
    serviceItemId?: string;
    q?: string;
    filtro?: string;
  }>;
};

export default async function CotacoesPage({ searchParams }: PageProps) {
  const session = await requireAuthorizedSession({ href: "/app/cotacoes" });
  const filters = await searchParams;
  const franchise = await getFranchiseBalance(session.organizationId);

  const statusLabel: Record<string, string> = {
    aberta: "Cotações abertas",
    em_negociacao: "Em negociação",
    aprovada: "Aprovadas",
    recusada: "Recusadas",
    finalizada_outros: "Finalizadas · Outros",
  };

  const [categories, quotations] = await Promise.all([
    firestoreDb.serviceCategory.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    firestoreDb.quotation.findMany({
      where: {
        organizationId: session.organizationId,
        ...(filters.status === "recusada"
          ? { status: { in: ["recusada", "finalizada_outros"] } }
          : filters.status
            ? { status: filters.status as QuotationStatus }
            : {}),
        ...(filters.filtro === "com_propostas" ? { proposalsCount: { gt: 0 } } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.serviceItemId ? { serviceItemId: filters.serviceItemId } : {}),
        ...(filters.q
          ? {
              OR: [
                { publicId: { contains: filters.q } },
                { description: { contains: filters.q } },
              ],
            }
          : {}),
      },
      include: {
        condominium: true,
        category: true,
        serviceItem: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const heading =
    filters.filtro === "com_propostas"
      ? "Com propostas recebidas"
      : filters.status
        ? statusLabel[filters.status] ?? "Cotações"
        : "Todas as cotações";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Cotações</p>
          <h1 className="mt-1 text-3xl font-bold text-neutral-900">{heading}</h1>
          <p className="mt-2 text-neutral-600">
            Franquia:{" "}
            {franchise.isUnlimited
              ? "ilimitada"
              : `${franchise.remaining} de ${franchise.limit} restantes`}
          </p>
        </div>
        {franchise.canCreate ? (
          <Link href="/app/cotacoes/nova">
            <Button>Nova cotação</Button>
          </Link>
        ) : (
          <div className="text-right">
            <Button disabled>Nova cotação</Button>
            <p className="mt-2 max-w-xs text-xs text-amber-700">
              Limite atingido. Faça upgrade para continuar.
            </p>
          </div>
        )}
      </div>

      <form className="grid gap-3 rounded-2xl border border-black/5 bg-white/80 p-4 md:grid-cols-4">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Buscar ID ou descrição"
          className="h-11 rounded-xl border border-black/10 px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={filters.status ?? ""}
          className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="em_negociacao">Em negociação</option>
          <option value="aprovada">Aprovada</option>
          <option value="recusada">Recusada</option>
          <option value="cancelada">Cancelada</option>
          <option value="encerrada">Encerrada</option>
        </select>
        <select
          name="categoryId"
          defaultValue={filters.categoryId ?? ""}
          className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm"
        >
          <option value="">Todas categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-11 rounded-xl bg-black/[0.04] text-sm font-semibold">
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/80">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Condomínio</th>
              <th className="px-4 py-3 font-medium">Categoria / Serviço</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {quotations.map((item) => (
              <tr key={item.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{item.publicId}</td>
                <td className="px-4 py-3">{item.condominium.name}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {item.category.name} · {item.serviceItem.name}
                </td>
                <td className="px-4 py-3 capitalize">{item.status.replace("_", " ")}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/app/cotacoes/${item.id}`}>
                    <Button type="button" size="sm" variant="secondary">
                      Detalhe
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
            {quotations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  Nenhuma cotação encontrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
