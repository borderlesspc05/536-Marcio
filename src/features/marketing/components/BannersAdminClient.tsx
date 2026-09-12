"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  deleteBannerAction,
  updateMarketingLinksAction,
  upsertBannerAction,
} from "@/features/marketing/actions";

const PROFILES = [
  { value: "sindico", label: "Síndico" },
  { value: "administradora", label: "Administradora" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "master_admin", label: "Master Admin" },
];

/** Área útil do carrossel no app (object-cover, altura ~192–224px). */
export const BANNER_SPECS = {
  recommendedWidth: 1600,
  recommendedHeight: 480,
  aspectRatio: "10:3",
  maxBytes: 2 * 1024 * 1024,
  safeZone:
    "Mantenha texto e logo na faixa central (~70% da largura). Evite conteúdo crítico nas bordas laterais (crop em mobile).",
};

type BannerRow = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  scrollIntervalMs: number;
  isActive: boolean;
  showOnLanding: boolean;
  showInApp: boolean;
  audienceMode: string;
  targetProfilesJson: string;
  targetUserIdsJson: string;
};

type Settings = {
  whatsappUrl: string | null;
  blogUrl: string | null;
  pixelScripts: string | null;
  supplierLpHost: string | null;
  supplierVideoUrl: string | null;
  maxActiveBanners: number;
};

type Props = {
  banners: BannerRow[];
  settings: Settings | null;
  userIdPlaceholder: string;
};

export function BannersAdminClient({ banners, settings, userIdPlaceholder }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [linksMessage, setLinksMessage] = useState<string | null>(null);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Banners e política de exibição</h1>
        <p className="mt-2 text-neutral-600">
          Até 10 ativos. Por imagem: landing e/ou app; todos os perfis, perfis específicos ou usuários.
        </p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Links públicos</h2>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          action={(formData) => {
            startTransition(async () => {
              const result = await updateMarketingLinksAction(formData);
              if (!result.ok) {
                setLinksError(result.message ?? "Erro ao salvar");
                setLinksMessage(null);
                return;
              }
              setLinksError(null);
              setLinksMessage(result.message ?? "Links salvos com sucesso.");
              router.refresh();
            });
          }}
        >
          <label className="text-sm">
            WhatsApp (wa.me)
            <input
              name="whatsappUrl"
              defaultValue={settings?.whatsappUrl ?? ""}
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Blog
            <input
              name="blogUrl"
              defaultValue={settings?.blogUrl ?? ""}
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Scripts de pixel (HTML/JS)
            <textarea
              name="pixelScripts"
              rows={3}
              defaultValue={settings?.pixelScripts ?? ""}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 font-mono text-xs"
            />
          </label>
          <label className="text-sm">
            Host LP Fornecedores
            <input
              name="supplierLpHost"
              defaultValue={settings?.supplierLpHost ?? ""}
              placeholder="https://fornecedores.exemplo.com"
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Vídeo da página de fornecedores (YouTube)
            <input
              name="supplierVideoUrl"
              type="url"
              defaultValue={settings?.supplierVideoUrl ?? ""}
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Cole a URL do vídeo. O player será exibido na página sem abrir o YouTube em outra aba.
            </span>
          </label>
          <label className="text-sm">
            Máx. banners ativos
            <input
              name="maxActiveBanners"
              type="number"
              min={1}
              max={20}
              defaultValue={settings?.maxActiveBanners ?? 10}
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar links"}
            </Button>
          </div>
          {linksMessage ? (
            <p className="md:col-span-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {linksMessage}
            </p>
          ) : null}
          {linksError ? (
            <p className="md:col-span-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {linksError}
            </p>
          ) : null}
        </form>
      </div>

      <div className="rounded-2xl border border-[#c10089]/15 bg-[#FFF7FB] p-5">
        <h2 className="font-semibold text-neutral-900">Especificações da arte</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>
            Dimensão recomendada:{" "}
            <strong>
              {BANNER_SPECS.recommendedWidth}×{BANNER_SPECS.recommendedHeight}px
            </strong>{" "}
            (proporção {BANNER_SPECS.aspectRatio})
          </li>
          <li>
            Exibição: carrossel full-bleed com <code>object-cover</code> — altura ~192–224px no app
          </li>
          <li>{BANNER_SPECS.safeZone}</li>
          <li>Formatos: JPG, PNG ou WEBP · máximo 2MB</li>
        </ul>
        <div className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-neutral-900">
          <div className="relative aspect-[10/3] w-full bg-gradient-to-r from-neutral-800 to-neutral-700">
            <div className="absolute inset-y-0 left-[15%] right-[15%] border-x-2 border-dashed border-emerald-400/70" />
            <p className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white/80">
              Área segura (conteúdo principal)
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Novo banner</h2>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          action={(formData) => {
            startTransition(async () => {
              const file = formData.get("imageFile");
              if (file instanceof File && file.size > 0) {
                if (!file.type.startsWith("image/")) {
                  setBannerError("Envie uma imagem (JPG, PNG ou WEBP).");
                  setBannerMessage(null);
                  return;
                }
                if (file.size > BANNER_SPECS.maxBytes) {
                  setBannerError("Imagem deve ter no máximo 2MB.");
                  setBannerMessage(null);
                  return;
                }
                const dataUrl = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result));
                  reader.onerror = () => reject(new Error("Falha ao ler imagem"));
                  reader.readAsDataURL(file);
                });
                formData.set("imageUrl", dataUrl);
              }
              const result = await upsertBannerAction(formData);
              if (!result.ok) {
                setBannerError(result.message ?? "Erro ao salvar banner");
                setBannerMessage(null);
                return;
              }
              setBannerError(null);
              setBannerMessage("Banner salvo com sucesso.");
              setPreviewUrl(null);
              if (fileRef.current) fileRef.current.value = "";
              router.refresh();
            });
          }}
        >
          <label className="text-sm md:col-span-2">
            Título
            <input name="title" required className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3" />
          </label>
          <label className="text-sm md:col-span-2">
            Upload da imagem
            <input
              ref={fileRef}
              name="imageFile"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-1 block w-full text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  setPreviewUrl(null);
                  return;
                }
                setPreviewUrl(URL.createObjectURL(file));
              }}
            />
          </label>
          <label className="text-sm md:col-span-2">
            Ou informe URL / caminho (ex.: /brand/banners/01-cotacoes.svg)
            <input
              name="imageUrl"
              defaultValue="/brand/banners/01-cotacoes.svg"
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Prévia"
              className="md:col-span-2 h-40 w-full rounded-xl object-cover ring-1 ring-black/10"
            />
          ) : null}
          <label className="text-sm">
            Link
            <input name="linkUrl" className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3" />
          </label>
          <label className="text-sm">
            Ordem
            <input
              name="sortOrder"
              type="number"
              defaultValue={banners.length + 1}
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Intervalo rolagem (ms)
            <input
              name="scrollIntervalMs"
              type="number"
              min={2000}
              max={60000}
              defaultValue={5500}
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Política de audiência
            <select name="audienceMode" defaultValue="all" className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3">
              <option value="all">Todos os perfis</option>
              <option value="profiles">Perfis específicos</option>
              <option value="users">Usuários específicos</option>
            </select>
          </label>
          <div className="text-sm md:col-span-2">
            <p className="mb-2 font-medium">Perfis (se modo = perfis)</p>
            <div className="flex flex-wrap gap-3">
              {PROFILES.map((profile) => (
                <label key={profile.value} className="flex items-center gap-2">
                  <input type="checkbox" name="targetProfiles" value={profile.value} />
                  {profile.label}
                </label>
              ))}
            </div>
          </div>
          <label className="text-sm md:col-span-2">
            IDs de usuários (se modo = usuários, separados por vírgula)
            <input
              name="targetUserIds"
              placeholder={userIdPlaceholder}
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3 font-mono text-xs"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked />
            Ativo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="showOnLanding" defaultChecked />
            Landing pública
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="showInApp" defaultChecked />
            Área autenticada (app)
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Adicionar banner"}
            </Button>
          </div>
          {bannerMessage ? (
            <p className="md:col-span-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {bannerMessage}
            </p>
          ) : null}
          {bannerError ? (
            <p className="md:col-span-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {bannerError}
            </p>
          ) : null}
        </form>
      </div>

      <div className="space-y-3">
        {banners.map((banner) => {
          let profiles: string[] = [];
          let userIds: string[] = [];
          try {
            profiles = JSON.parse(banner.targetProfilesJson || "[]") as string[];
            userIds = JSON.parse(banner.targetUserIdsJson || "[]") as string[];
          } catch {
            profiles = [];
            userIds = [];
          }
          return (
            <div key={banner.id} className="rounded-2xl border border-black/5 bg-white/80 p-4">
              <div className="flex flex-wrap gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banner.imageUrl}
                  alt=""
                  className="h-20 w-40 rounded-lg object-cover ring-1 ring-black/10"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{banner.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    #{banner.sortOrder} · {banner.isActive ? "ativo" : "inativo"} · LP:{" "}
                    {banner.showOnLanding ? "sim" : "não"} · App: {banner.showInApp ? "sim" : "não"} ·
                    Audiência: {banner.audienceMode}
                    {banner.audienceMode === "profiles" ? ` (${profiles.join(", ") || "—"})` : ""}
                    {banner.audienceMode === "users" ? ` (${userIds.length} user(s))` : ""}
                  </p>
                </div>
              </div>
              <form
                className="mt-3"
                action={(formData) => {
                  startTransition(async () => {
                    const result = await deleteBannerAction(formData);
                    if (!result.ok) {
                      setBannerError(result.message ?? "Erro ao remover");
                      return;
                    }
                    setBannerMessage("Banner removido.");
                    router.refresh();
                  });
                }}
              >
                <input type="hidden" name="id" value={banner.id} />
                <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                  Remover
                </Button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
