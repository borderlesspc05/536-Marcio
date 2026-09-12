"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  inviteExternalApproverAction,
  type ActionResult,
} from "@/features/external-approver/actions";
import { CondoTagPicker } from "@/features/external-approver/components/CondoTagPicker";

type Condo = { id: string; name: string };

export function InviteExternalApproverForm({ condominiums }: { condominiums: Condo[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      className="mt-4 grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const next = await inviteExternalApproverAction(formData);
          setResult(next);
          if (next.ok) router.refresh();
        });
      }}
    >
      <label className="text-sm">
        Nome
        <input name="name" required className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3" />
      </label>
      <label className="text-sm">
        E-mail
        <input
          name="email"
          type="email"
          required
          className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
        />
      </label>
      <div className="md:col-span-2">
        <CondoTagPicker condominiums={condominiums} />
      </div>
      <div className="md:col-span-2 space-y-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Cadastrando…" : "Cadastrar aprovador"}
        </Button>
        {result?.message ? (
          <p
            className={`rounded-xl px-3 py-2 text-sm ${
              result.ok
                ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {result.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
