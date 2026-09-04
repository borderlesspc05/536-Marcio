import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { Button } from "@/components/ui/Button";
import {
  createServiceItemAction,
  softDeleteServiceItemAction,
  updateCategoryAction,
} from "@/features/catalog/actions";

type PageProps = { params: Promise<{ categoryId: string }> };

export default async function CategoryDetailPage({ params }: PageProps) {
  await requireAuthorizedSession({ href: "/app/plataforma/catalogo" });
  const { categoryId } = await params;

  const category = await firestoreDb.serviceCategory.findFirst({
    where: { id: categoryId, deletedAt: null },
    include: {
      items: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/plataforma/catalogo" className="text-sm text-[#9333EA] hover:underline">
          ← Voltar ao catálogo
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-neutral-900">{category.name}</h1>
        <p className="mt-1 text-neutral-600">
          Categoria mãe · {category.items.length} segmentos · token {category.colorToken}
        </p>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await updateCategoryAction(formData);
        }}
        className="grid gap-3 rounded-2xl border border-black/5 bg-white/80 p-5 md:grid-cols-4"
      >
        <input type="hidden" name="id" value={category.id} />
        <input
          name="name"
          defaultValue={category.name}
          className="h-11 rounded-xl border border-black/10 px-3 text-sm md:col-span-2"
        />
        <input
          name="colorToken"
          defaultValue={category.colorToken ?? ""}
          className="h-11 rounded-xl border border-black/10 px-3 text-sm"
        />
        <input
          name="sortOrder"
          type="number"
          defaultValue={category.sortOrder}
          className="h-11 rounded-xl border border-black/10 px-3 text-sm"
        />
        <label className="flex items-center gap-2 text-sm md:col-span-3">
          <input type="checkbox" name="isActive" defaultChecked={category.isActive} />
          Categoria ativa
        </label>
        <Button type="submit">Salvar categoria</Button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/80">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 bg-black/[0.02] text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Serviço</th>
                <th className="px-4 py-3 font-medium">Flags</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {category.items.map((item) => (
                <tr key={item.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {item.isMandatory ? "Obrigatório" : "—"}
                    {item.periodicityHint ? ` · ${item.periodicityHint}` : ""}
                  </td>
                  <td className="px-4 py-3">{item.isActive ? "Ativo" : "Inativo"}</td>
                  <td className="px-4 py-3 text-right">
                    <form
                      action={async (formData) => {
                        "use server";
                        await softDeleteServiceItemAction(formData);
                      }}
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="categoryId" value={category.id} />
                      <button type="submit" className="text-red-600 hover:underline">
                        Excluir
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          action={async (formData) => {
            "use server";
            await createServiceItemAction(formData);
          }}
          className="space-y-3 rounded-2xl border border-black/5 bg-white/80 p-5"
        >
          <h2 className="text-lg font-semibold">Novo serviço</h2>
          <input type="hidden" name="categoryId" value={category.id} />
          <input
            name="name"
            required
            placeholder="Nome do serviço"
            className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          />
          <input
            name="periodicityHint"
            placeholder="Periodicidade (ex.: semestral)"
            className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          />
          <input
            name="sortOrder"
            type="number"
            defaultValue={category.items.length + 1}
            className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isMandatory" />
            Serviço obrigatório
          </label>
          <Button type="submit" className="w-full">
            Adicionar serviço
          </Button>
        </form>
      </div>
    </div>
  );
}
