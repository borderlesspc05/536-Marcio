"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  removeServiceClientManagerAction,
  resendServiceClientManagerAccessAction,
  updateServiceClientManagerAction,
} from "@/features/master-service/actions";

type Props = {
  managerId: string;
  name: string;
  email: string;
  roleLabel: string;
};

export function ServiceClientManagerRow({ managerId, name, email, roleLabel }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="border-b border-black/5 py-3">
      {!editing ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium text-neutral-900">
              {name} · {email}
            </p>
            <p className="text-xs capitalize text-neutral-500">{roleLabel}</p>
            {message ? <p className="mt-1 text-xs text-emerald-700">{message}</p> : null}
            {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => setEditing(true)}
            >
              Editar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                const formData = new FormData();
                formData.set("managerId", managerId);
                startTransition(async () => {
                  const result = await resendServiceClientManagerAccessAction(formData);
                  if (!result.ok) {
                    setError(result.message ?? "Erro");
                    setMessage(null);
                    return;
                  }
                  setError(null);
                  setMessage(result.message ?? "OK");
                });
              }}
            >
              Reenviar acesso
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Remover vínculo de ${name}?`)) return;
                const formData = new FormData();
                formData.set("managerId", managerId);
                startTransition(async () => {
                  const result = await removeServiceClientManagerAction(formData);
                  if (!result.ok) {
                    setError(result.message ?? "Erro");
                    setMessage(null);
                    return;
                  }
                  router.refresh();
                });
              }}
            >
              Excluir
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="grid gap-2 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await updateServiceClientManagerAction(formData);
              if (!result.ok) {
                setError(result.message ?? "Erro");
                setMessage(null);
                return;
              }
              setError(null);
              setMessage(result.message ?? "OK");
              setEditing(false);
              router.refresh();
            });
          }}
        >
          <input type="hidden" name="managerId" value={managerId} />
          <input
            name="name"
            defaultValue={name}
            required
            className="h-9 rounded-lg border border-black/10 px-2 text-sm"
          />
          <input
            name="email"
            type="email"
            defaultValue={email}
            required
            className="h-9 rounded-lg border border-black/10 px-2 text-sm"
          />
          <select
            name="roleLabel"
            defaultValue={roleLabel}
            className="h-9 rounded-lg border border-black/10 px-2 text-sm"
          >
            <option value="gerente">Gerente</option>
            <option value="assistente">Assistente</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              Salvar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
