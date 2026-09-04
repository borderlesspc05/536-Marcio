import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import {
  deleteBannerAction,
  updateMarketingLinksAction,
  upsertBannerAction,
} from "@/features/marketing/actions";
import { formAction } from "@/lib/form-action";
import { Button } from "@/components/ui/Button";

const PROFILES = [
  { value: "sindico", label: "Síndico" },
  { value: "administradora", label: "Administradora" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "master_admin", label: "Master Admin" },
];

export default async function BannersAdminPage() {
  await requireAuthorizedSession({
    types: [OrganizationType.master_admin],
    href: "/app/plataforma/banners",
  });

  const [banners, settings, users] = await Promise.all([
    firestoreDb.landingBanner.findMany({ orderBy: { sortOrder: "asc" } }),
    firestoreDb.marketingSettings.findUnique({ where: { id: "default" } }),
    firestoreDb.user.findMany({
      select: { id: true, email: true, name: true },
      orderBy: { email: "asc" },
      take: 50,
    }),
  ]);

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
        <form action={formAction(updateMarketingLinksAction)} className="mt-4 grid gap-3 md:grid-cols-2">
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
          <Button type="submit">Salvar links</Button>
        </form>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Novo banner</h2>
        <form action={formAction(upsertBannerAction)} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            Título
            <input name="title" required className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3" />
          </label>
          <label className="text-sm">
            Imagem (URL ou /brand/...)
            <input
              name="imageUrl"
              required
              defaultValue="/brand/banners/01-cotacoes.svg"
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
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
              placeholder={users.slice(0, 2).map((u) => u.id).join(", ")}
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
          <Button type="submit">Adicionar</Button>
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
              <p className="font-semibold">{banner.title}</p>
              <p className="mt-1 text-xs text-neutral-500">
                #{banner.sortOrder} · {banner.isActive ? "ativo" : "inativo"} · LP:{" "}
                {banner.showOnLanding ? "sim" : "não"} · App: {banner.showInApp ? "sim" : "não"} ·
                Audiência: {banner.audienceMode}
                {banner.audienceMode === "profiles" ? ` (${profiles.join(", ") || "—"})` : ""}
                {banner.audienceMode === "users" ? ` (${userIds.length} user(s))` : ""}
              </p>
              <form action={formAction(deleteBannerAction)} className="mt-3">
                <input type="hidden" name="id" value={banner.id} />
                <Button type="submit" size="sm" variant="secondary">
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
