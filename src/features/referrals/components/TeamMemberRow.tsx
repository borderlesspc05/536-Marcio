"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  removeTeamMemberAction,
  resendTeamMemberAccessAction,
  updateTeamMemberAction,
} from "@/features/referrals/actions";

type Props = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  scopeLabel: string;
  canManage: boolean;
  isSelf: boolean;
};

export function TeamMemberRow({
  membershipId,
  name,
  email,
  role,
  scopeLabel,
  canManage,
  isSelf,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roleLabel =
    role === "external_approver" ? "Aprovador Externo" : role === "master" ? "Master" : "Operacional";
  const isExternal = role === "external_approver";

  return (
    <tr className="border-b border-black/5 last:border-0 align-top">
      <td className="px-4 py-3 font-medium" colSpan={editing ? 4 : undefined}>
        {!editing ? (
          name
        ) : (
          <form
            className="grid gap-2 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              startTransition(async () => {
                const result = await updateTeamMemberAction(formData);
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
            <input type="hidden" name="membershipId" value={membershipId} />
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
              name="role"
              defaultValue={role}
              className="h-9 rounded-lg border border-black/10 px-2 text-sm"
            >
              <option value="operational">Operacional</option>
              <option value="master">Master</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                Salvar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
        {message ? <p className="mt-1 text-xs text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
      </td>
      {!editing ? (
        <>
          <td className="px-4 py-3 text-neutral-600">{email}</td>
          <td className="px-4 py-3 capitalize">{roleLabel}</td>
          <td className="px-4 py-3 text-neutral-600">
            <div className="flex flex-col gap-2">
              <span>{scopeLabel}</span>
              {canManage && !isExternal ? (
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
                      formData.set("membershipId", membershipId);
                      startTransition(async () => {
                        const result = await resendTeamMemberAccessAction(formData);
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
                  {!isSelf ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm(`Remover ${name} da organização?`)) return;
                        const formData = new FormData();
                        formData.set("membershipId", membershipId);
                        startTransition(async () => {
                          const result = await removeTeamMemberAction(formData);
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
                  ) : null}
                </div>
              ) : null}
            </div>
          </td>
        </>
      ) : null}
    </tr>
  );
}
