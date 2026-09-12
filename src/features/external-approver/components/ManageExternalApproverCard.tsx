"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  removeExternalApproverAction,
  resendExternalApproverAccessAction,
  updateExternalApproverScopesAction,
  type ActionResult,
} from "@/features/external-approver/actions";
import { CondoTagPicker } from "@/features/external-approver/components/CondoTagPicker";

type Condo = { id: string; name: string };

export function ManageExternalApproverCard({
  userId,
  name,
  email,
  condominiums,
  linkedIds,
}: {
  userId: string;
  name: string;
  email: string;
  condominiums: Condo[];
  linkedIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-sm text-neutral-500">{email}</p>
          {!editing ? (
            <p className="mt-2 text-xs text-neutral-600">
              Condomínios:{" "}
              {condominiums
                .filter((condo) => linkedIds.includes(condo.id))
                .map((condo) => condo.name)
                .join(", ") || "—"}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? "Fechar edição" : "Editar condomínios"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              const formData = new FormData();
              formData.set("userId", userId);
              startTransition(async () => {
                const next = await resendExternalApproverAccessAction(formData);
                setResult(next);
              });
            }}
          >
            Reenviar acesso
          </Button>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!window.confirm(`Remover aprovador ${name}?`)) return;
              const formData = new FormData(event.currentTarget);
              startTransition(async () => {
                const next = await removeExternalApproverAction(formData);
                setResult(next);
                if (next.ok) router.refresh();
              });
            }}
          >
            <input type="hidden" name="userId" value={userId} />
            <Button type="submit" size="sm" variant="ghost" disabled={pending}>
              Excluir
            </Button>
          </form>
        </div>
      </div>

      {editing ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const next = await updateExternalApproverScopesAction(formData);
              setResult(next);
              if (next.ok) {
                setEditing(false);
                router.refresh();
              }
            });
          }}
        >
          <input type="hidden" name="userId" value={userId} />
          <CondoTagPicker
            condominiums={condominiums}
            defaultSelectedIds={linkedIds}
            label="Alterar condomínios vinculados"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Salvando…" : "Salvar vínculos"}
          </Button>
        </form>
      ) : null}

      {result?.message ? (
        <p
          className={`mt-3 rounded-xl px-3 py-2 text-sm ${
            result.ok
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
