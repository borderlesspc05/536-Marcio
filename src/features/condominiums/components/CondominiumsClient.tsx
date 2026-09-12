"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileSpreadsheet, Plus, Search } from "lucide-react";
import { archiveCondominiumAction } from "@/features/condominiums/actions";
import {
  CondominiumForm,
  type CondominiumFormValues,
} from "@/features/condominiums/components/CondominiumForm";
import { ImportCondominiumsForm } from "@/features/condominiums/components/ImportCondominiumsForm";
import { formatCnpj } from "@/lib/cnpj";

type Row = CondominiumFormValues & { address: string };

type Props = {
  condominiums: Row[];
  query?: string;
};

type TabId = "lista" | "novo" | "importar";

export function CondominiumsClient({ condominiums, query }: Props) {
  const [editing, setEditing] = useState<CondominiumFormValues | null>(null);
  const [tab, setTab] = useState<TabId>("lista");

  const tabs: Array<{ id: TabId; label: string; icon: typeof Building2; hint: string }> = [
    {
      id: "lista",
      label: `Carteira (${condominiums.length})`,
      icon: Building2,
      hint: "Consultar e editar",
    },
    {
      id: "novo",
      label: editing ? "Editar" : "Cadastrar",
      icon: Plus,
      hint: editing ? "Atualizar dados" : "Novo condomínio",
    },
    {
      id: "importar",
      label: "Importar CSV",
      icon: FileSpreadsheet,
      hint: "Carga em lote",
    },
  ];

  return (
    <div className="space-y-5">
      <form className="flex flex-wrap gap-2 rounded-2xl border border-black/5 bg-white/80 p-3">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Buscar por nome, endereço ou CNPJ"
            className="h-11 w-full rounded-xl border border-black/10 bg-white pl-10 pr-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className="h-11 rounded-xl bg-black/[0.04] px-4 text-sm font-semibold text-neutral-800"
        >
          Filtrar
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id !== "novo") setEditing(null);
                setTab(item.id);
              }}
              className={`flex min-w-[140px] flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition sm:flex-none ${
                active
                  ? "border-[#c10089]/30 bg-[#FFF7FB] shadow-sm"
                  : "border-black/5 bg-white/80 hover:border-black/10"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  active ? "bg-[#c10089] text-white" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-neutral-900">{item.label}</span>
                <span className="block text-[11px] text-neutral-500">{item.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {tab === "lista" ? (
        <section className="overflow-hidden rounded-2xl border border-black/5 bg-white/80">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Condomínios ativos</h2>
              <p className="text-xs text-neutral-500">
                Clique em editar para abrir o formulário no módulo de cadastro.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setTab("novo");
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#c10089] px-3 text-xs font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo
            </button>
          </div>

          {condominiums.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-medium text-neutral-700">Nenhum condomínio encontrado.</p>
              <p className="mt-1 text-xs text-neutral-500">
                Cadastre manualmente ou importe um CSV para montar a carteira.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setTab("novo")}
                  className="rounded-xl bg-[#c10089] px-4 py-2 text-sm font-semibold text-white"
                >
                  Cadastrar
                </button>
                <button
                  type="button"
                  onClick={() => setTab("importar")}
                  className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-neutral-700"
                >
                  Importar CSV
                </button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-black/5">
              {condominiums.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 hover:bg-black/[0.015]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-neutral-900">{item.name}</p>
                    <p className="mt-0.5 text-sm text-neutral-600">{item.address}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      CNPJ {item.document ? formatCnpj(item.document) : "—"}
                      {" · "}
                      Torres {item.towers ?? "—"} · Unidades {item.units ?? "—"}
                      {item.contactName ? ` · ${item.contactName}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="h-9 rounded-xl border border-[#c10089]/20 bg-[#FFF7FB] px-3 text-sm font-semibold text-[#9a006e]"
                      onClick={() => {
                        setEditing({
                          id: item.id,
                          name: item.name,
                          address: item.address,
                          document: item.document,
                          contactName: item.contactName,
                          contactEmail: item.contactEmail,
                          contactPhone: item.contactPhone,
                          towers: item.towers,
                          units: item.units,
                        });
                        setTab("novo");
                      }}
                    >
                      Editar
                    </button>
                    <ArchiveButton id={item.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "novo" ? (
        <section className="mx-auto max-w-2xl">
          <CondominiumForm
            key={editing?.id ?? "new"}
            initial={editing}
            onCancelEdit={
              editing
                ? () => {
                    setEditing(null);
                    setTab("lista");
                  }
                : () => setTab("lista")
            }
            onSaved={() => {
              setEditing(null);
              setTab("lista");
            }}
          />
        </section>
      ) : null}

      {tab === "importar" ? (
        <section className="mx-auto max-w-2xl">
          <ImportCondominiumsForm onDone={() => setTab("lista")} />
        </section>
      ) : null}
    </div>
  );
}

function ArchiveButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        if (!window.confirm("Excluir este condomínio da carteira?")) return;
        startTransition(async () => {
          formData.set("id", id);
          await archiveCondominiumAction(formData);
          router.refresh();
        });
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-xl px-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "..." : "Excluir"}
      </button>
    </form>
  );
}
