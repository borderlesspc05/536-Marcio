import Link from "next/link";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { Button } from "@/components/ui/Button";
import { createCategoryAction, softDeleteCategoryAction } from "@/features/catalog/actions";

export default async function CatalogPage() {
  await requireAuthorizedSession({ href: "/app/plataforma/catalogo" });

  const categories = await firestoreDb.serviceCategory.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { items: { where: { deletedAt: null } } } } },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Catálogo</p>
          <h1 className="mt-1 text-3xl font-bold text-neutral-900">Categorias e segmentos</h1>
          <p className="mt-2 text-neutral-600">
            Clique em Abrir na categoria mãe para gerenciar os segmentos (filhos). {categories.length}{" "}
            categorias · seed oficial 13×110
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/80">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 bg-black/[0.02] text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Cor</th>
                <th className="px-4 py-3 font-medium">Segmentos</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3 font-medium text-neutral-900">{category.name}</td>
                  <td className="px-4 py-3 capitalize text-neutral-600">{category.colorToken}</td>
                  <td className="px-4 py-3 text-neutral-600">{category._count.items}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        category.isActive
                          ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                          : "rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-500"
                      }
                    >
                      {category.isActive ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/app/plataforma/catalogo/${category.id}`} className="text-[#9333EA] hover:underline">
                        Abrir
                      </Link>
                      <form
                        action={async (formData) => {
                          "use server";
                          await softDeleteCategoryAction(formData);
                        }}
                      >
                        <input type="hidden" name="id" value={category.id} />
                        <button type="submit" className="text-red-600 hover:underline">
                          Excluir
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          action={async (formData) => {
            "use server";
            await createCategoryAction(formData);
          }}
          className="space-y-3 rounded-2xl border border-black/5 bg-white/80 p-5"
        >
          <h2 className="text-lg font-semibold text-neutral-900">Nova categoria</h2>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="name">
              Nome
            </label>
            <input
              id="name"
              name="name"
              required
              className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none ring-fuchsia-200 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="colorToken">
              Token de cor
            </label>
            <input
              id="colorToken"
              name="colorToken"
              required
              placeholder="azul, verde, amarelo..."
              className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none ring-fuchsia-200 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="sortOrder">
              Ordem
            </label>
            <input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={categories.length + 1}
              className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none ring-fuchsia-200 focus:ring-2"
            />
          </div>
          <Button type="submit" className="w-full">
            Criar categoria
          </Button>
        </form>
      </div>
    </div>
  );
}
