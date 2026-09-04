import Link from "next/link";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { CondominiumsClient } from "@/features/condominiums/components/CondominiumsClient";

type PageProps = { searchParams: Promise<{ q?: string }> };

export default async function CondominiosPage({ searchParams }: PageProps) {
  const session = await requireAuthorizedSession({ href: "/app/condominios" });
  const { q } = await searchParams;
  const query = q?.trim();

  const condominiums = await firestoreDb.condominium.findMany({
    where: {
      organizationId: session.organizationId,
      archivedAt: null,
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { address: { contains: query } },
              { document: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Condomínios</p>
          <h1 className="mt-1 text-3xl font-bold text-neutral-900">Carteira da organização</h1>
          <p className="mt-2 text-neutral-600">{condominiums.length} ativos</p>
        </div>
        <Link href="/app/cotacoes/nova" className="text-sm font-semibold text-[#9333EA] hover:underline">
          Abrir nova cotação →
        </Link>
      </div>

      <CondominiumsClient condominiums={condominiums} query={query} />
    </div>
  );
}
