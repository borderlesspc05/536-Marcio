"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/features/master-service/action-result";

type Props = {
  action: (formData: FormData) => Promise<ActionResult>;
  className?: string;
  children: ReactNode;
  onSuccessRefresh?: boolean;
};

/** Formulário Master Service com feedback de erro/sucesso (não engole ActionResult). */
export function ServiceActionForm({
  action,
  className,
  children,
  onSuccessRefresh = true,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const next = await action(formData);
          setResult(next);
          if (next.ok && onSuccessRefresh) router.refresh();
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {result?.message ? (
        <p
          className={`mt-2 rounded-xl px-3 py-2 text-sm ${
            result.ok
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
