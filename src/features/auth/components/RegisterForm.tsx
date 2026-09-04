"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerAction, type ActionResult } from "@/features/auth/actions";
import { Button } from "@/components/ui/Button";

export function RegisterForm({
  defaultType = "sindico",
  referralCode,
}: {
  defaultType?: string;
  referralCode?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const initialType = ["sindico", "administradora", "fornecedor"].includes(defaultType)
    ? defaultType
    : "sindico";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationType, setOrganizationType] = useState(initialType);
  const [organizationName, setOrganizationName] = useState("");
  const [document, setDocument] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        startTransition(async () => {
          const response = await registerAction(formData);
          setResult(response);
          if (response.ok) {
            const nextEmail = String(formData.get("email") ?? email);
            const params = new URLSearchParams({ email: nextEmail });
            if (response.devCode) params.set("devCode", response.devCode);
            router.push(`/confirmar?${params.toString()}`);
          }
        });
      }}
    >
      {referralCode ? <input type="hidden" name="referralCode" value={referralCode} /> : null}
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="name">
          Nome completo
        </label>
        <input
          id="name"
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none ring-fuchsia-200 focus:ring-2"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none ring-fuchsia-200 focus:ring-2"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none ring-fuchsia-200 focus:ring-2"
          placeholder="Mín. 8 caracteres, 1 maiúscula e 1 número"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="organizationType">
          Tipo de perfil
        </label>
        <select
          id="organizationType"
          name="organizationType"
          required
          value={organizationType}
          onChange={(event) => setOrganizationType(event.target.value)}
          className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none ring-fuchsia-200 focus:ring-2"
        >
          <option value="sindico">Síndico (Solicitante)</option>
          <option value="administradora">Administradora (Solicitante)</option>
          <option value="fornecedor">Fornecedor</option>
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="organizationName">
          Nome da empresa / condomínio
        </label>
        <input
          id="organizationName"
          name="organizationName"
          required
          value={organizationName}
          onChange={(event) => setOrganizationName(event.target.value)}
          className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none ring-fuchsia-200 focus:ring-2"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="document">
          CNPJ (opcional)
        </label>
        <input
          id="document"
          name="document"
          value={document}
          onChange={(event) => setDocument(event.target.value)}
          className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none ring-fuchsia-200 focus:ring-2"
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          name="privacyAccepted"
          className="mt-1"
          required
          checked={privacyAccepted}
          onChange={(event) => setPrivacyAccepted(event.target.checked)}
        />
        <span>
          Li e aceito a política de privacidade (LGPD) e o tratamento dos meus dados para uso da
          plataforma.
        </span>
      </label>

      {result && !result.ok ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{result.message}</p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Criando conta..." : "Criar conta"}
      </Button>

      <p className="text-center text-sm text-neutral-600">
        Já tem conta?{" "}
        <Link href="/acesse" className="font-semibold text-[#9333EA] hover:underline">
          Acesse
        </Link>
      </p>
    </form>
  );
}
