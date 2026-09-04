import Link from "next/link";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { getFranchiseBalance } from "@/features/quotations/franchise";
import { NewQuotationForm } from "@/features/quotations/components/NewQuotationForm";

export default async function NovaCotacaoPage() {
  const session = await requireAuthorizedSession({ href: "/app/cotacoes" });

  const [condominiums, categories, services, franchise] = await Promise.all([
    firestoreDb.condominium.findMany({
      where: { organizationId: session.organizationId, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    firestoreDb.serviceCategory.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    firestoreDb.serviceItem.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        categoryId: true,
        isMandatory: true,
        periodicityHint: true,
      },
    }),
    getFranchiseBalance(session.organizationId),
  ]);

  const franchiseLabel = franchise.isUnlimited
    ? "Ilimitada"
    : `${franchise.remaining} restantes de ${franchise.limit}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/app/cotacoes" className="text-sm text-[#9333EA] hover:underline">
          ← Voltar às cotações
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-neutral-900">Nova cotação</h1>
        <p className="mt-2 text-neutral-600">
          Selecione categoria e serviço do catálogo oficial. A franquia é validada antes da criação.
        </p>
      </div>

      {condominiums.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Cadastre ao menos um condomínio antes de abrir uma cotação.{" "}
          <Link href="/app/condominios" className="font-semibold underline">
            Ir para condomínios
          </Link>
        </div>
      ) : (
        <NewQuotationForm
          condominiums={condominiums}
          categories={categories}
          services={services}
          canCreate={franchise.canCreate}
          franchiseLabel={franchiseLabel}
        />
      )}
    </div>
  );
}
