"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp, Paperclip, X } from "lucide-react";
import {
  changePasswordAction,
  updateOrganizationBrandAction,
  updateOrganizationLogoAction,
  updateProfileAction,
  type ActionResult,
} from "@/features/auth/actions";
import { Button } from "@/components/ui/Button";

type Props = {
  defaultName: string;
  defaultEmail: string;
  logoUrl?: string | null;
  showLogoUpload?: boolean;
  showWhitelabelBrand?: boolean;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdateProfileForm({
  defaultName,
  defaultEmail,
  logoUrl,
  showLogoUpload = false,
  showWhitelabelBrand = false,
  primaryColor = "#9333EA",
  secondaryColor = "#14B8A6",
}: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [passwordResult, setPasswordResult] = useState<ActionResult | null>(null);
  const [logoResult, setLogoResult] = useState<ActionResult | null>(null);
  const [brandResult, setBrandResult] = useState<ActionResult | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDragging, setLogoDragging] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  function assignLogo(next: File | null) {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (next) {
      if (!next.type.startsWith("image/")) {
        setLogoResult({ ok: false, message: "Envie uma imagem (PNG, JPG ou WEBP)." });
        return;
      }
      if (next.size > LOGO_MAX_BYTES) {
        setLogoResult({ ok: false, message: "Logo deve ter no máximo 2MB." });
        return;
      }
      setLogoResult(null);
      setLogoFile(next);
      setLogoPreview(URL.createObjectURL(next));
      if (logoInputRef.current) {
        const transfer = new DataTransfer();
        transfer.items.add(next);
        logoInputRef.current.files = transfer.files;
      }
      return;
    }
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  return (
    <div className="space-y-8">
      {showLogoUpload ? (
        <form
          className="space-y-3"
          action={(formData) => {
            startTransition(async () => {
              if (!logoFile) {
                setLogoResult({ ok: false, message: "Selecione uma imagem de logo." });
                return;
              }
              const response = await updateOrganizationLogoAction(formData);
              setLogoResult(response);
              if (response.ok) assignLogo(null);
            });
          }}
        >
          <label className="mb-2 block text-sm font-semibold text-neutral-800">
            Logo da organização
          </label>
          {logoUrl && !logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo da organização"
              className="mb-2 h-16 w-16 rounded-xl border border-black/10 object-contain bg-white"
            />
          ) : null}

          <input
            ref={logoInputRef}
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            className="sr-only"
            onChange={(event) => assignLogo(event.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setLogoDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setLogoDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setLogoDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setLogoDragging(false);
              const dropped = event.dataTransfer.files?.[0];
              if (dropped) assignLogo(dropped);
            }}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${
              logoDragging
                ? "border-[#c10089] bg-[#FFF7FB]"
                : logoFile
                  ? "border-emerald-300 bg-emerald-50/70"
                  : "border-black/15 bg-neutral-50 hover:border-[#c10089]/50 hover:bg-[#FFF7FB]"
            }`}
          >
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt="Prévia da logo"
                className="h-16 w-16 rounded-xl border border-black/10 bg-white object-contain"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c10089]/10 text-[#c10089]">
                <FileUp className="h-6 w-6" aria-hidden />
              </span>
            )}
            {logoFile ? (
              <>
                <span className="text-sm font-semibold text-neutral-900">Arquivo selecionado</span>
                <span className="max-w-full truncate px-2 text-sm text-emerald-800">{logoFile.name}</span>
                <span className="text-xs text-neutral-500">
                  {formatBytes(logoFile.size)} · clique ou arraste para trocar
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-neutral-900">
                  Arraste a logo aqui ou clique para anexar
                </span>
                <span className="text-xs text-neutral-500">PNG, JPG ou WEBP · até 2MB</span>
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-[#c10089] px-3 py-1.5 text-xs font-bold text-white">
                  <Paperclip className="h-3.5 w-3.5" aria-hidden />
                  Escolher arquivo
                </span>
              </>
            )}
          </button>

          {logoFile ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">{logoFile.name}</p>
                <p className="text-xs text-neutral-500">{formatBytes(logoFile.size)}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-red-50 hover:text-red-700"
                aria-label="Remover logo selecionada"
                onClick={() => assignLogo(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <p className="text-xs text-neutral-500">
            Usada no RIF e no portal whitelabel. Preferência: fundo transparente ou branco.
          </p>
          {logoResult?.ok ? (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {logoResult.message}
            </p>
          ) : null}
          {logoResult && !logoResult.ok ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{logoResult.message}</p>
          ) : null}
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Enviando..." : "Enviar logo"}
          </Button>
        </form>
      ) : null}

      {showWhitelabelBrand ? (
        <form
          className="space-y-4 rounded-xl border border-black/[0.06] bg-neutral-50/80 p-4"
          action={(formData) => {
            startTransition(async () => {
              const response = await updateOrganizationBrandAction(formData);
              setBrandResult(response);
            });
          }}
        >
          <div>
            <h3 className="text-sm font-bold text-neutral-950">Paleta whitelabel</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Cores aplicadas ao RIF, comparativo e portal do cliente Premium / Cota Service.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-neutral-800">
              Cor primária
              <input
                name="primaryColor"
                type="color"
                defaultValue={primaryColor || "#9333EA"}
                className="mt-2 h-12 w-full cursor-pointer rounded-xl border border-black/10 bg-white px-2"
              />
            </label>
            <label className="text-sm font-semibold text-neutral-800">
              Cor secundária
              <input
                name="secondaryColor"
                type="color"
                defaultValue={secondaryColor || "#14B8A6"}
                className="mt-2 h-12 w-full cursor-pointer rounded-xl border border-black/10 bg-white px-2"
              />
            </label>
          </div>
          {brandResult?.ok ? (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {brandResult.message}
            </p>
          ) : null}
          {brandResult && !brandResult.ok ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{brandResult.message}</p>
          ) : null}
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Salvando..." : "Salvar paleta"}
          </Button>
        </form>
      ) : null}

      <form
        className="space-y-5"
        action={(formData) => {
          startTransition(async () => {
            const response = await updateProfileAction(formData);
            setResult(response);
          });
        }}
      >
        <div>
          <label className="mb-2 block text-sm font-semibold text-neutral-800" htmlFor="email">
            E-mail de acesso
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={defaultEmail}
            className="h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 hover:border-black/20 focus:border-[#9333EA]/40 focus:ring-4 focus:ring-[#9333EA]/10"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-neutral-800" htmlFor="name">
            Nome de exibição
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            defaultValue={defaultName}
            aria-describedby="name-help"
            className="h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 hover:border-black/20 focus:border-[#9333EA]/40 focus:ring-4 focus:ring-[#9333EA]/10"
          />
          <p id="name-help" className="mt-2 text-xs leading-5 text-neutral-500">
            Este nome aparece no cabeçalho, nas cotações e no histórico de atividades.
          </p>
        </div>

        {result?.ok ? (
          <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {result.message}
          </p>
        ) : null}
        {result && !result.ok ? (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {result.message}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="min-w-36 active:translate-y-px">
          {pending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </form>

      <form
        className="space-y-4 border-t border-black/[0.06] pt-6"
        action={(formData) => {
          startTransition(async () => {
            const response = await changePasswordAction(formData);
            setPasswordResult(response);
          });
        }}
      >
        <h3 className="text-sm font-bold text-neutral-950">Alteração de senha</h3>
        <input
          name="currentPassword"
          type="password"
          required
          placeholder="Senha atual"
          className="h-12 w-full rounded-xl border border-black/10 px-4 text-sm"
        />
        <input
          name="newPassword"
          type="password"
          required
          minLength={6}
          placeholder="Nova senha"
          className="h-12 w-full rounded-xl border border-black/10 px-4 text-sm"
        />
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          placeholder="Confirmar nova senha"
          className="h-12 w-full rounded-xl border border-black/10 px-4 text-sm"
        />
        {passwordResult?.ok ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {passwordResult.message}
          </p>
        ) : null}
        {passwordResult && !passwordResult.ok ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {passwordResult.message}
          </p>
        ) : null}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Atualizando..." : "Alterar senha"}
        </Button>
      </form>
    </div>
  );
}
