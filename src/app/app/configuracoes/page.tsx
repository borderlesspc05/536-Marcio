import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Fingerprint,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { getSession } from "@/lib/auth/session";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { UpdateProfileForm } from "@/features/auth/components/UpdateProfileForm";
import { SupplierInviteUsersCard } from "@/features/auth/components/SupplierInviteUsersCard";
import { profileLabel } from "@/features/navigation/menu";
import { getPlanGate, can } from "@/features/billing/plan-gate";

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const ACTIVITY_LABELS: Record<string, string> = {
  "auth.register": "Conta criada",
  "auth.profile_updated": "Nome de exibição atualizado",
  "auth.password_reset_completed": "Senha de acesso redefinida",
  "auth.password_changed": "Senha de acesso alterada",
  "auth.password_reset_requested": "Redefinição de senha solicitada",
  "auth.login_success": "Novo acesso à conta",
  "auth.login_failed": "Tentativa de acesso não concluída",
  "auth.logout": "Sessão encerrada",
  "auth.email_confirmed": "E-mail confirmado",
  "auth.privacy_accepted": "Termos de privacidade aceitos",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDocument(document: string | null) {
  if (!document) return "Não informado";
  const digits = document.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return document;
}

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/acesse");

  const [user, organization, subscription, activity, planGate] = await Promise.all([
    firestoreDb.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: {
        name: true,
        email: true,
        emailVerifiedAt: true,
        privacyAcceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    firestoreDb.organization.findUniqueOrThrow({
      where: { id: session.organizationId },
      select: {
        name: true,
        document: true,
        type: true,
        createdAt: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        _count: { select: { members: true } },
      },
    }),
    firestoreDb.subscription.findFirst({
      where: { organizationId: session.organizationId },
      include: { plan: { select: { name: true, isFree: true } } },
      orderBy: { createdAt: "desc" },
    }),
    firestoreDb.auditLog.findMany({
      where: { userId: session.userId, action: { startsWith: "auth." } },
      select: { id: true, action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    getPlanGate(session.organizationId),
  ]);

  const isAdministrator = session.role === MemberRole.master;
  const planOrganizationTypes: OrganizationType[] = [
    OrganizationType.fornecedor,
    OrganizationType.sindico,
    OrganizationType.administradora,
  ];
  const hasPlanArea = planOrganizationTypes.includes(session.organizationType);
  const profile = profileLabel(session.organizationType, session.role);
  const showWhitelabelBrand =
    (session.organizationType === OrganizationType.administradora ||
      session.organizationType === OrganizationType.sindico) &&
    Boolean(
      can(planGate, "whitelabel") || can(planGate, "rif") || can(planGate, "cotaService"),
    );
  const completionItems = [
    { label: "Nome definido", complete: user.name.trim().length >= 2 },
    { label: "E-mail confirmado", complete: Boolean(user.emailVerifiedAt) },
    { label: "Privacidade aceita", complete: Boolean(user.privacyAcceptedAt) },
    { label: "Documento da organização", complete: Boolean(organization.document) },
  ];
  const completedItems = completionItems.filter((item) => item.complete).length;

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-8">
      <header>
        <p className="text-sm font-semibold text-[#9333EA]">Conta e preferências</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950">Configurações</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
          Gerencie sua identidade, acompanhe a segurança da conta e consulte os dados da
          organização.
        </p>
      </header>

      <section className="relative overflow-hidden rounded-2xl bg-neutral-950 px-6 py-6 text-white shadow-[0_20px_50px_-30px_rgba(88,28,135,0.55)] sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#9333EA]/30 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 text-xl font-bold shadow-inner">
              {organization.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={organization.logoUrl}
                  alt={organization.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                initials(user.name)
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold">{user.name}</h2>
              <p className="mt-1 truncate text-sm text-white/65">{user.email}</p>
              <span className="mt-3 inline-flex rounded-lg border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80">
                {profile}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 border-t border-white/10 pt-5 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
            <div>
              <p className="text-xs text-white/50">Organização</p>
              <p className="mt-1 max-w-44 truncate text-sm font-semibold">
                {organization.name}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50">Plano atual</p>
              <p className="mt-1 text-sm font-semibold">{subscription?.plan.name ?? "Institucional"}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-50 text-[#9333EA]">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold text-neutral-950">Perfil pessoal</h2>
                <p className="mt-1 text-sm leading-5 text-neutral-500">
                  Informações usadas para identificar suas ações na plataforma.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 border-b border-black/[0.06] pb-6 sm:grid-cols-2">
              <div className="rounded-xl bg-neutral-50 px-4 py-3.5">
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Conta criada em
                </div>
                <p className="mt-2 text-sm font-semibold text-neutral-900">
                  {DATE_FORMAT.format(user.createdAt)}
                </p>
              </div>
              <div className="rounded-xl bg-neutral-50 px-4 py-3.5">
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                  <Mail className="h-3.5 w-3.5" />
                  E-mail atual
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-neutral-900">{user.email}</p>
              </div>
            </div>

            <div className="mt-6">
              <UpdateProfileForm
                defaultName={user.name}
                defaultEmail={user.email}
                logoUrl={organization.logoUrl}
                showLogoUpload={
                  session.organizationType === OrganizationType.fornecedor ||
                  session.organizationType === OrganizationType.administradora ||
                  session.organizationType === OrganizationType.sindico
                }
                showWhitelabelBrand={showWhitelabelBrand}
                primaryColor={
                  (organization as { primaryColor?: string | null }).primaryColor ?? "#9333EA"
                }
                secondaryColor={
                  (organization as { secondaryColor?: string | null }).secondaryColor ?? "#14B8A6"
                }
              />
            </div>
          </section>

          {session.organizationType === OrganizationType.fornecedor ? (
            <SupplierInviteUsersCard isFreePlan={planGate?.isFree ?? subscription?.plan.isFree ?? true} />
          ) : null}

          <section className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-bold text-neutral-950">Organização</h2>
                  <p className="mt-1 text-sm leading-5 text-neutral-500">
                    Cadastro corporativo vinculado ao seu acesso.
                  </p>
                </div>
              </div>
              <span className="w-fit rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
                {isAdministrator ? "Administrador" : "Operacional"}
              </span>
            </div>

            <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-neutral-500">Razão ou nome da organização</dt>
                <dd className="mt-1.5 text-sm font-semibold text-neutral-900">{organization.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">CPF ou CNPJ</dt>
                <dd className="mt-1.5 text-sm font-semibold text-neutral-900">
                  {formatDocument(organization.document)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">Integrantes</dt>
                <dd className="mt-1.5 text-sm font-semibold text-neutral-900">
                  {organization._count.members}{" "}
                  {organization._count.members === 1 ? "acesso ativo" : "acessos ativos"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-neutral-500">Cadastro iniciado em</dt>
                <dd className="mt-1.5 text-sm font-semibold text-neutral-900">
                  {DATE_FORMAT.format(organization.createdAt)}
                </dd>
              </div>
            </dl>

            {session.organizationType === OrganizationType.administradora ? (
              <Link
                href="/app/equipe"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#9333EA] hover:text-[#7E22CE]"
              >
                Gerenciar equipe
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-neutral-950">Status da conta</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {completedItems} de {completionItems.length} itens concluídos
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </span>
            </div>
            <ul className="mt-5 space-y-3">
              {completionItems.map((item) => (
                <li key={item.label} className="flex items-center gap-2.5 text-sm">
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 ${
                      item.complete ? "text-emerald-600" : "text-neutral-300"
                    }`}
                  />
                  <span className={item.complete ? "text-neutral-700" : "text-neutral-400"}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
            <div className="px-6 pb-3 pt-6">
              <h2 className="font-bold text-neutral-950">Acessos rápidos</h2>
              <p className="mt-1 text-xs text-neutral-500">Atalhos relacionados à sua conta.</p>
            </div>
            <nav className="p-2">
              <QuickLink
                href="/app/notificacoes"
                icon={Bell}
                title="Notificações"
                description="Mensagens e atualizações"
              />
              <QuickLink
                href="/recuperar-senha"
                icon={KeyRound}
                title="Segurança"
                description="Redefinir senha de acesso"
              />
              {hasPlanArea ? (
                <QuickLink
                  href="/app/meu-plano"
                  icon={CreditCard}
                  title="Plano e cobrança"
                  description="Assinatura e pagamentos"
                />
              ) : null}
              {session.organizationType === OrganizationType.administradora ? (
                <QuickLink
                  href="/app/equipe"
                  icon={Users}
                  title="Equipe"
                  description="Acessos da organização"
                />
              ) : null}
            </nav>
          </section>

          <section className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-[#9333EA]" />
              <h2 className="font-bold text-neutral-950">Atividade recente</h2>
            </div>
            {activity.length > 0 ? (
              <ol className="mt-5 space-y-4">
                {activity.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#9333EA]" />
                    <div>
                      <p className="text-sm font-medium leading-5 text-neutral-800">
                        {ACTIVITY_LABELS[item.action] ?? "Atividade registrada na conta"}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
                        <Clock3 className="h-3 w-3" />
                        {DATE_FORMAT.format(item.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                Nenhuma alteração de conta registrada recentemente.
              </p>
            )}
            <p className="mt-5 text-xs leading-5 text-neutral-400">
              Alterações sensíveis ficam registradas para segurança e auditoria.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

type QuickLinkProps = {
  href: string;
  icon: typeof Bell;
  title: string;
  description: string;
};

function QuickLink({ href, icon: Icon, title, description }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-colors group-hover:bg-fuchsia-50 group-hover:text-[#9333EA]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-neutral-800">{title}</span>
        <span className="block truncate text-xs text-neutral-500">{description}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 text-neutral-300 transition-colors group-hover:text-[#9333EA]" />
    </Link>
  );
}
