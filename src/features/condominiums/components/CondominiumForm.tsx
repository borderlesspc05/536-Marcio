"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  createCondominiumAction,
  updateCondominiumAction,
} from "@/features/condominiums/actions";

export type CondominiumFormValues = {
  id: string;
  name: string;
  address: string;
  document: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  towers: number | null;
  units: number | null;
};

type Props = {
  initial?: CondominiumFormValues | null;
  onCancelEdit?: () => void;
  onSaved?: () => void;
};

export function CondominiumForm({ initial = null, onCancelEdit, onSaved }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial?.id);

  return (
    <form
      className="space-y-4 rounded-2xl border border-black/5 bg-white/80 p-5 sm:p-6"
      action={(formData) => {
        startTransition(async () => {
          const result = isEdit
            ? await updateCondominiumAction(formData)
            : await createCondominiumAction(formData);
          if (!result.ok) {
            setError(result.message ?? "Erro ao salvar");
            setMessage(null);
            return;
          }
          setError(null);
          setMessage(result.message ?? "Salvo com sucesso.");
          onSaved?.();
          router.refresh();
        });
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#c10089]">
            {isEdit ? "Etapa · Edição" : "Etapa · Cadastro"}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-neutral-900">
            {isEdit ? "Editar condomínio" : "Novo condomínio"}
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Preencha os dados principais. Torres e unidades são opcionais.
          </p>
        </div>
        {onCancelEdit ? (
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-sm font-medium text-neutral-500 hover:underline"
          >
            Voltar
          </button>
        ) : null}
      </div>

      {isEdit ? <input type="hidden" name="id" value={initial!.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          Nome *
          <input
            name="name"
            required
            defaultValue={initial?.name ?? ""}
            className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Endereço *
          <input
            name="address"
            required
            defaultValue={initial?.address ?? ""}
            className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          CNPJ
          <input
            name="document"
            defaultValue={initial?.document ?? ""}
            className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          Contato
          <input
            name="contactName"
            defaultValue={initial?.contactName ?? ""}
            className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          E-mail
          <input
            name="contactEmail"
            type="email"
            defaultValue={initial?.contactEmail ?? ""}
            className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          Telefone
          <input
            name="contactPhone"
            defaultValue={initial?.contactPhone ?? ""}
            className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          Torres
          <input
            name="towers"
            type="number"
            min={1}
            defaultValue={initial?.towers ?? ""}
            className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          Unidades
          <input
            name="units"
            type="number"
            min={1}
            defaultValue={initial?.units ?? ""}
            className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 text-sm"
          />
        </label>
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Salvando..." : isEdit ? "Atualizar" : "Cadastrar"}
      </Button>
    </form>
  );
}
