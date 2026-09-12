"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  createPartnershipAction,
  endPartnershipAction,
} from "@/features/partnerships/actions";

export type PartnerCandidate = {
  id: string;
  name: string;
  logoUrl: string | null;
  eligible: boolean;
  categoryNames: string[];
};

export type ActivePartner = {
  id: string;
  supplierOrgId: string;
  name: string;
  logoUrl: string | null;
  categoryLabel: string | null;
};

type Category = { id: string; name: string };

type Props = {
  activePartners: ActivePartner[];
  candidates: PartnerCandidate[];
  categories: Category[];
  lockEnabled: boolean;
  canManage?: boolean;
};

function Logo({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-10 w-10 rounded-xl border border-black/10 bg-white object-contain"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-xs font-bold text-neutral-600">
      {initials || "?"}
    </div>
  );
}

export function PartnershipsPanel({
  activePartners,
  candidates,
  categories,
  lockEnabled,
  canManage = true,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryBySupplier, setCategoryBySupplier] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((item) => item.name.toLowerCase().includes(q));
  }, [candidates, query]);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "Erro");
        setFeedback(null);
        return;
      }
      setError(null);
      setFeedback(result.message ?? "OK");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Parceiros ativos</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Prioridade 1 no motor de distribuição (categoria + plano pago).
          {lockEnabled ? " Trava Growth Loop ativa." : ""}
        </p>
        <div className="mt-4 space-y-3">
          {activePartners.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhum parceiro vinculado.</p>
          ) : (
            activePartners.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/5 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Logo url={item.logoUrl} name={item.name} />
                  <div className="min-w-0">
                    <p className="font-medium">{item.name}</p>
                    {item.categoryLabel ? (
                      <p className="text-xs text-[#9333EA]">Categoria: {item.categoryLabel}</p>
                    ) : (
                      <p className="text-xs text-neutral-500">Todas as categorias do pacote</p>
                    )}
                  </div>
                </div>
                {canManage ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      const formData = new FormData();
                      formData.set("partnershipId", item.id);
                      run(() => endPartnershipAction(formData));
                    }}
                  >
                    Encerrar
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {canManage ? (
      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Adicionar parceiro</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Busque pelo nome. Exibimos nome e logo. Só empresas aptas podem ser vinculadas — sem
          revelar plano ou motivo de inaptidão (LGPD).
        </p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar empresa pelo nome"
          className="mt-4 h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
        />
        <div className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhuma empresa encontrada.</p>
          ) : (
            filtered.map((supplier) => (
              <div
                key={supplier.id}
                className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-black/5 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Logo url={supplier.logoUrl} name={supplier.name} />
                  <div className="min-w-0">
                    <p className="font-medium">{supplier.name}</p>
                    {supplier.eligible ? (
                      <p className="text-xs text-neutral-500">
                        {supplier.categoryNames.join(", ") || "Categorias do pacote"}
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-400">Indisponível para vínculo</p>
                    )}
                  </div>
                </div>
                {supplier.eligible ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="block text-xs text-neutral-600">
                      Categoria (opcional)
                      <select
                        className="mt-1 h-9 rounded-xl border border-black/10 bg-white px-2 text-sm"
                        value={categoryBySupplier[supplier.id] ?? ""}
                        onChange={(event) =>
                          setCategoryBySupplier((prev) => ({
                            ...prev,
                            [supplier.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Todas as categorias</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        const formData = new FormData();
                        formData.set("supplierOrgId", supplier.id);
                        const categoryId = categoryBySupplier[supplier.id];
                        if (categoryId) formData.set("categoryId", categoryId);
                        run(() => createPartnershipAction(formData));
                      }}
                    >
                      Vincular
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
      ) : (
        <p className="rounded-2xl border border-black/5 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Visualização das parcerias ativas. Vincular ou encerrar exige perfil Master.
        </p>
      )}

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {feedback ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{feedback}</p>
      ) : null}
    </div>
  );
}
