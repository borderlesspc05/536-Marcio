"use client";

import { useMemo, useState } from "react";

type Condo = { id: string; name: string };

type Props = {
  condominiums: Condo[];
  name?: string;
  defaultSelectedIds?: string[];
  label?: string;
};

/** Busca + tags (estilo Instagram) para vincular condomínios. */
export function CondoTagPicker({
  condominiums,
  name = "condominiumIds",
  defaultSelectedIds = [],
  label = "Condomínios vinculados",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(defaultSelectedIds);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedCondos = condominiums.filter((condo) => selectedSet.has(condo.id));
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = condominiums.filter((condo) => !selectedSet.has(condo.id));
    if (!q) return pool.slice(0, 12);
    return pool.filter((condo) => condo.name.toLowerCase().includes(q)).slice(0, 20);
  }, [condominiums, query, selectedSet]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  return (
    <fieldset className="space-y-2 text-sm">
      <legend className="font-medium">{label} *</legend>
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <div className="flex flex-wrap gap-2">
        {selectedCondos.length === 0 ? (
          <p className="text-xs text-neutral-500">Nenhum condomínio marcado ainda.</p>
        ) : (
          selectedCondos.map((condo) => (
            <button
              key={condo.id}
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-[#9333EA]/10 px-3 py-1 text-xs font-semibold text-[#6b21a8]"
              onClick={() => toggle(condo.id)}
            >
              {condo.name}
              <span aria-hidden>×</span>
            </button>
          ))
        )}
      </div>

      <div className="relative">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar condomínio para vincular…"
          className="h-10 w-full rounded-xl border border-black/10 px-3 text-sm"
        />
        {open ? (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-black/10 bg-white shadow-lg">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-neutral-500">Nenhum resultado.</p>
            ) : (
              filtered.map((condo) => (
                <button
                  key={condo.id}
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm hover:bg-fuchsia-50"
                  onClick={() => {
                    toggle(condo.id);
                    setQuery("");
                  }}
                >
                  {condo.name}
                </button>
              ))
            )}
            <button
              type="button"
              className="w-full border-t border-black/5 px-3 py-2 text-left text-xs font-semibold text-neutral-500"
              onClick={() => setOpen(false)}
            >
              Fechar busca
            </button>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}
