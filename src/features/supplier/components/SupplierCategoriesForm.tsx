"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { updateSupplierCategoriesAction } from "@/features/supplier/actions";

type SegmentOption = { id: string; name: string; categoryId: string };
type CategoryOption = { id: string; name: string; segments: SegmentOption[] };

type SelectedLink = {
  categoryId: string;
  serviceItemId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

type Props = {
  categories: CategoryOption[];
  initialLinks: SelectedLink[];
  maxCategories: number;
  maxSegments: number;
  isFree: boolean;
  allowExtraFree: boolean;
};

function pairKey(categoryId: string, serviceItemId: string) {
  return `${categoryId}:${serviceItemId}`;
}

export function SupplierCategoriesForm({
  categories,
  initialLinks,
  maxCategories,
  maxSegments,
  isFree,
  allowExtraFree,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(initialLinks[0]?.categoryId ?? null);
  const [links, setLinks] = useState<SelectedLink[]>(initialLinks);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  const selectedCategoryCount = useMemo(
    () => new Set(links.map((l) => l.categoryId)).size,
    [links],
  );
  const selectedSegmentCount = links.length;

  function isSelected(categoryId: string, serviceItemId: string) {
    return links.some((l) => l.categoryId === categoryId && l.serviceItemId === serviceItemId);
  }

  function toggleSegment(categoryId: string, serviceItemId: string) {
    setLinks((prev) => {
      const exists = prev.find(
        (l) => l.categoryId === categoryId && l.serviceItemId === serviceItemId,
      );
      if (exists) {
        return prev.filter(
          (l) => !(l.categoryId === categoryId && l.serviceItemId === serviceItemId),
        );
      }

      const nextCategories = new Set([...prev.map((l) => l.categoryId), categoryId]);
      if (nextCategories.size > maxCategories || prev.length >= maxSegments) {
        setUpgradeRequired(true);
        setError(
          isFree && !allowExtraFree
            ? "Plano Free contempla 1 categoria + 1 subcategoria (segmento). Faça upgrade para adicionar mais."
            : `Limite do plano: ${maxCategories} categoria(s) e ${maxSegments} subcategoria(s).`,
        );
        return prev;
      }

      setUpgradeRequired(false);
      setError(null);
      return [
        ...prev,
        {
          categoryId,
          serviceItemId,
          contactName: "",
          contactEmail: "",
          contactPhone: "",
        },
      ];
    });
  }

  function updateContact(
    categoryId: string,
    serviceItemId: string,
    field: "contactName" | "contactEmail" | "contactPhone",
    value: string,
  ) {
    setLinks((prev) =>
      prev.map((link) =>
        link.categoryId === categoryId && link.serviceItemId === serviceItemId
          ? { ...link, [field]: value }
          : link,
      ),
    );
  }

  return (
    <form
      className="space-y-4"
      action={() => {
        startTransition(async () => {
          const formData = new FormData();
          for (const link of links) {
            const key = pairKey(link.categoryId, link.serviceItemId);
            formData.append("pairs", key);
            formData.set(`contactName:${key}`, link.contactName);
            formData.set(`contactEmail:${key}`, link.contactEmail);
            formData.set(`contactPhone:${key}`, link.contactPhone);
          }
          const result = await updateSupplierCategoriesAction(formData);
          if (!result.ok) {
            setError(result.message ?? "Erro ao salvar");
            setUpgradeRequired(Boolean(result.upgradeRequired));
            setMessage(null);
            return;
          }
          setError(null);
          setUpgradeRequired(false);
          setMessage(result.message ?? "Salvo");
          router.refresh();
        });
      }}
    >
      <p className="text-sm text-neutral-600">
        Selecione <strong>1 categoria</strong> e, dentro dela, <strong>1 subcategoria (segmento)</strong>.
        Plano Free: {maxCategories} categoria + {maxSegments} subcategoria — acima disso é upgrade.
        Selecionados:{" "}
        <strong>
          {selectedCategoryCount}/{maxCategories}
        </strong>{" "}
        categorias ·{" "}
        <strong>
          {selectedSegmentCount}/{maxSegments}
        </strong>{" "}
        subcategorias
        {allowExtraFree ? " (liberação piloto ativa)" : ""}.
      </p>

      <div className="space-y-2">
        {categories.map((category) => {
          const open = expanded === category.id;
          const selectedInCategory = links.filter((l) => l.categoryId === category.id);
          return (
            <div key={category.id} className="rounded-xl border border-black/10 bg-white">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
                onClick={() => setExpanded(open ? null : category.id)}
              >
                <span>
                  {category.name}
                  {selectedInCategory.length > 0
                    ? ` · ${selectedInCategory.length} subcategoria(s)`
                    : ""}
                </span>
                <span className="text-neutral-400">{open ? "−" : "+"}</span>
              </button>
              {open ? (
                <div className="space-y-3 border-t border-black/5 px-4 py-3">
                  <p className="text-xs text-neutral-500">
                    Escolha 1 subcategoria dentro desta categoria (plano Free).
                  </p>
                  {category.segments.map((segment) => {
                    const checked = isSelected(category.id, segment.id);
                    return (
                      <div key={segment.id} className="rounded-lg border border-black/5 p-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSegment(category.id, segment.id)}
                          />
                          <span className="font-medium">{segment.name}</span>
                          <span className="text-xs text-neutral-400">subcategoria</span>
                        </label>
                        {checked ? (
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <input
                              placeholder="Contato"
                              value={
                                links.find(
                                  (l) =>
                                    l.categoryId === category.id &&
                                    l.serviceItemId === segment.id,
                                )?.contactName ?? ""
                              }
                              onChange={(e) =>
                                updateContact(category.id, segment.id, "contactName", e.target.value)
                              }
                              className="h-9 rounded-lg border border-black/10 px-2 text-sm"
                            />
                            <input
                              placeholder="E-mail"
                              value={
                                links.find(
                                  (l) =>
                                    l.categoryId === category.id &&
                                    l.serviceItemId === segment.id,
                                )?.contactEmail ?? ""
                              }
                              onChange={(e) =>
                                updateContact(
                                  category.id,
                                  segment.id,
                                  "contactEmail",
                                  e.target.value,
                                )
                              }
                              className="h-9 rounded-lg border border-black/10 px-2 text-sm"
                            />
                            <input
                              placeholder="Telefone"
                              value={
                                links.find(
                                  (l) =>
                                    l.categoryId === category.id &&
                                    l.serviceItemId === segment.id,
                                )?.contactPhone ?? ""
                              }
                              onChange={(e) =>
                                updateContact(
                                  category.id,
                                  segment.id,
                                  "contactPhone",
                                  e.target.value,
                                )
                              }
                              className="h-9 rounded-lg border border-black/10 px-2 text-sm"
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {upgradeRequired ? (
        <Link href="/checkout?plan=fornecedor-pro">
          <Button type="button" variant="secondary">
            Fazer upgrade de plano
          </Button>
        </Link>
      ) : null}
      {message ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
      ) : null}
      <Button type="submit" disabled={pending || links.length === 0}>
        {pending ? "Salvando..." : "Salvar categorias e segmentos"}
      </Button>
    </form>
  );
}
