"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { inviteSupplierUserAction } from "@/features/auth/actions";

type Props = {
  isFreePlan: boolean;
};

export function SupplierInviteUsersCard({ isFreePlan }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  if (isFreePlan) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 shadow-sm">
        <h2 className="font-bold text-neutral-950">Cadastrar novos usuários</h2>
        <p className="mt-2 text-sm text-amber-900">
          No plano Condo Free esta função fica bloqueada. Faça upgrade para convidar operadores da
          sua equipe.
        </p>
        <Link href="/app/meu-plano" className="mt-4 inline-block">
          <Button type="button">Ver planos e fazer upgrade</Button>
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm">
      <h2 className="font-bold text-neutral-950">Cadastrar novos usuários</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Convide operadores da sua organização (plano pago).
      </p>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        action={(formData) => {
          startTransition(async () => {
            const result = await inviteSupplierUserAction(formData);
            if (!result.ok) {
              setError(result.message ?? "Erro");
              setUpgradeRequired(Boolean(result.upgradeRequired));
              setMessage(null);
              if (result.upgradeRequired) router.push("/app/meu-plano");
              return;
            }
            setError(null);
            setUpgradeRequired(false);
            setMessage(
              result.tempPassword
                ? `${result.message} Senha temporária: ${result.tempPassword}`
                : result.message ?? "OK",
            );
            router.refresh();
          });
        }}
      >
        <input
          name="name"
          required
          placeholder="Nome"
          className="h-11 rounded-xl border border-black/10 px-3 text-sm"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="E-mail"
          className="h-11 rounded-xl border border-black/10 px-3 text-sm"
        />
        <Button type="submit" disabled={pending} className="sm:col-span-2">
          {pending ? "Cadastrando..." : "Cadastrar usuário"}
        </Button>
      </form>
      {upgradeRequired ? (
        <p className="mt-3 text-sm text-amber-800">Upgrade necessário — redirecionando para Meu Plano.</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
    </section>
  );
}
