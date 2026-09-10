import Link from "next/link";
import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { profileLabel } from "@/features/navigation/menu";
import {
  getDashboardKpis,
  getSupplierDashboardKpis,
} from "@/features/quotations/kpis";
import { markOverdueCompliance } from "@/features/compliance/expire";
import { getMarketingSettings } from "@/features/marketing/data";
import { formatPriceCents } from "@/features/billing/money";
import { getServicePipelineCounts } from "@/features/master-service/data";
import {
  SERVICE_PIPELINE_LABELS,
  SERVICE_PIPELINE_ORDER,
} from "@/features/master-service/pipeline";
import { Button } from "@/components/ui/Button";
import { StatusShareChart } from "@/components/app/StatusShareChart";

type DashCard = {
  title: string;
  value: string;
  hint?: string;
  href?: string;
};

export default async function AppHomePage() {
  const session = await getSession();
  if (!session) redirect("/acesse");
  if (session.role === MemberRole.external_approver) {
    redirect("/app/aprovador/cotacoes");
  }

  const label = profileLabel(session.organizationType, session.role);
  const isSolicitante =
    session.organizationType === OrganizationType.sindico ||
    session.organizationType === OrganizationType.administradora;
  const isFornecedor = session.organizationType === OrganizationType.fornecedor;
  const isAdmMaster =
    session.organizationType === OrganizationType.administradora &&
    session.role === MemberRole.master;
  const isMasterService = session.organizationType === OrganizationType.master_service;

  if (isFornecedor) {
    await markOverdueCompliance(session.organizationId);
  }

  const [kpis, supplierKpis, marketing, serviceCounts] = await Promise.all([
    isFornecedor || isMasterService
      ? Promise.resolve(null)
      : getDashboardKpis({
          organizationId: session.organizationId,
          organizationType: session.organizationType,
        }),
    isFornecedor
      ? getSupplierDashboardKpis(session.organizationId)
      : Promise.resolve(null),
    getMarketingSettings(),
    isMasterService
      ? getServicePipelineCounts(session.organizationId)
      : Promise.resolve(null),
  ]);

  const solicitanteCards: DashCard[] =
    isSolicitante && kpis
      ? [
          {
            title: "Cotações abertas",
            value: String(kpis.openQuotations),
            href: "/app/cotacoes?status=aberta",
          },
          {
            title: "Em negociação",
            value: String(kpis.inNegotiation),
            href: "/app/cotacoes?status=em_negociacao",
          },
          {
            title: "Propostas recebidas",
            value: String(kpis.proposalsReceived),
            href: "/app/cotacoes?filtro=com_propostas",
          },
          {
            title: "Aprovadas",
            value: String(kpis.approved),
            href: "/app/cotacoes?status=aprovada",
          },
          {
            title: "Recusadas",
            value: String(kpis.rejected),
            href: "/app/cotacoes?status=recusada",
          },
          {
            title: "Saldo de franquia",
            value: kpis.isUnlimited ? "∞" : String(kpis.franchiseRemaining ?? 0),
            hint: kpis.isUnlimited
              ? "Franquia ilimitada"
              : `Usadas ${kpis.franchiseUsed} de ${kpis.franchiseLimit}`,
          },
          ...(isAdmMaster
            ? [
                {
                  title: "Receita de parcerias",
                  value: formatPriceCents(kpis.partnershipRevenueCents ?? 0),
                  hint: "Expectativa + accruals",
                  href: "/app/financeiro",
                } satisfies DashCard,
              ]
            : []),
        ]
      : [];

  const supplierCards: DashCard[] = supplierKpis
    ? [
        {
          title: "Oportunidades pendentes",
          value: String(supplierKpis.pendingOpportunities),
          href: "/app/oportunidades?view=lista&status=pendente",
        },
        {
          title: "Em negociação",
          value: String(supplierKpis.inNegotiation),
          href: "/app/oportunidades?view=kanban",
        },
        {
          title: "Propostas enviadas",
          value: String(supplierKpis.proposalsSent),
          href: "/app/oportunidades?view=lista&status=enviada",
        },
        {
          title: "Aprovadas / fechadas",
          value: String(supplierKpis.approved),
          hint: formatPriceCents(supplierKpis.closedVolumeCents),
          href: "/app/oportunidades?view=lista&status=aprovada",
        },
        {
          title: "Recusadas / perdidas",
          value: String(supplierKpis.rejected),
          hint: formatPriceCents(supplierKpis.rejectedVolumeCents),
          href: "/app/oportunidades?view=lista&status=recusada",
        },
        {
          title: "Saldo do mês",
          value: supplierKpis.isUnlimited
            ? "∞"
            : String(supplierKpis.franchiseRemaining ?? 0),
          hint: supplierKpis.isUnlimited
            ? "Ilimitado"
            : `Usadas ${supplierKpis.franchiseUsed} de ${supplierKpis.franchiseLimit}`,
          href: "/app/meu-plano",
        },
      ]
    : [];

  const masterCards: DashCard[] =
    session.organizationType === OrganizationType.master_admin
      ? [
          { title: "Categorias", value: "13", href: "/app/plataforma/catalogo" },
          { title: "Serviços", value: "110", href: "/app/plataforma/catalogo" },
          { title: "Banners", value: "LP + App", href: "/app/plataforma/banners" },
          { title: "Compliance", value: "Fila", href: "/app/plataforma/compliance" },
        ]
      : [];

  const serviceCards: DashCard[] =
    isMasterService && serviceCounts
      ? SERVICE_PIPELINE_ORDER.map((status) => ({
          title: SERVICE_PIPELINE_LABELS[status],
          value: String(serviceCounts[status]),
          href: `/app/service/cotacoes?status=${status}`,
        }))
      : [];

  const cards = serviceCards.length
    ? serviceCards
    : solicitanteCards.length
      ? solicitanteCards
      : supplierCards.length
        ? supplierCards
        : masterCards;

  const capabilities = isMasterService
    ? [
        "Gerir clientes Cota Service com whitelabel (logo, cores e link exclusivo)",
        "Pipeline: Em Liberação, Andamento, Negociação, Análise, Recusadas e Aprovadas",
        "Validar, editar fluxo, gerar Análise RIF e liberar aceite ao solicitante",
        "Blindagem de contato até o aceite final; relatórios e inteligência de mercado",
      ]
    : session.organizationType === OrganizationType.fornecedor
      ? [
          "Receber cotações por categorias do pacote",
          "Enviar propostas com múltiplas condições e anexos",
          "Atualizar documentos de compliance",
          "Gerenciar planos contratados e configurar categorias",
          "Gerenciar o funil de oportunidades (Kanban)",
          "Ser notificado sobre convites e status",
          "Enxergar numericamente e financeiramente oportunidades fechadas e perdidas",
        ]
      : session.organizationType === OrganizationType.administradora &&
          session.role === MemberRole.master
        ? [
            "Dashboard com cotações abertas, negociação, aprovadas e recusadas",
            "Receita de parcerias com % ou valor editável por fornecedor",
            "Convidar usuários e gerenciar indicações com link personalizado",
            "Parcerias, favoritos Premium e comissionamento",
          ]
        : session.organizationType === OrganizationType.sindico ||
            session.organizationType === OrganizationType.administradora
          ? [
              "Cadastre condomínios e abra cotações com franquia mensal",
              "Compare propostas, negocie e aprove na plataforma",
              "Acompanhe KPIs clicáveis no dashboard",
            ]
          : [
              "Parametrize franquias, planos e lembretes",
              "Gerencie banners (política por perfil/usuário), WhatsApp e catálogo",
              "Audite compliance e migrações de perfil",
            ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#c10089]">Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900">
            Olá, {session.name}
          </h1>
          <p className="mt-2 text-neutral-500">
            Você está em{" "}
            <span className="font-semibold text-neutral-800">{session.organizationName}</span> como{" "}
            <span className="font-semibold text-neutral-800">{label}</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isMasterService ? (
            <>
              <Link href="/app/service/cotacoes">
                <Button>Abrir pipeline</Button>
              </Link>
              <Link href="/app/service/clientes">
                <Button variant="secondary">Clientes</Button>
              </Link>
            </>
          ) : null}
          {isSolicitante && kpis?.canCreateQuotation ? (
            <Link href="/app/cotacoes/nova">
              <Button>Nova cotação</Button>
            </Link>
          ) : null}
          {isSolicitante && kpis && !kpis.canCreateQuotation ? (
            <div className="text-right">
              <Button disabled>Nova cotação</Button>
              <p className="mt-2 max-w-xs text-xs text-amber-700">Franquia esgotada.</p>
            </div>
          ) : null}
          {isFornecedor ? (
            <>
              <Link href="/app/oportunidades">
                <Button>Oportunidades</Button>
              </Link>
              <Link href={marketing.whatsappUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary" className="gap-2">
                  <MessageCircle className="h-4 w-4 text-[#25D366]" />
                  Suporte
                </Button>
              </Link>
            </>
          ) : null}
          {isAdmMaster ? (
            <Link href="/app/indicacoes">
              <Button variant="secondary">Indicações</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const inner = (
            <>
              <p className="text-sm text-neutral-500">{card.title}</p>
              <p className="mt-2 text-3xl font-bold text-neutral-900">{card.value}</p>
              {card.hint ? <p className="mt-1 text-xs text-neutral-400">{card.hint}</p> : null}
              {card.href ? (
                <p className="mt-3 text-xs font-semibold text-[#c10089]">Abrir →</p>
              ) : null}
            </>
          );
          return card.href ? (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-sm backdrop-blur transition hover:border-[#c10089]/30 hover:shadow-md"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={card.title}
              className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-sm backdrop-blur"
            >
              {inner}
            </div>
          );
        })}
      </div>

      {isSolicitante && kpis ? (
        <StatusShareChart
          title="Cotações por status (%)"
          items={[
            { label: "Abertas", value: kpis.openQuotations, color: "#00aab3" },
            { label: "Em negociação", value: kpis.inNegotiation, color: "#c10089" },
            { label: "Aprovadas", value: kpis.approved, color: "#059669" },
            { label: "Recusadas", value: kpis.rejected, color: "#e11d48" },
          ]}
        />
      ) : null}

      {isFornecedor && supplierKpis ? (
        <StatusShareChart
          title="Oportunidades por status (%)"
          items={[
            { label: "Pendentes", value: supplierKpis.pendingOpportunities, color: "#00aab3" },
            { label: "Em negociação", value: supplierKpis.inNegotiation, color: "#c10089" },
            { label: "Enviadas", value: supplierKpis.proposalsSent, color: "#00535a" },
            { label: "Aprovadas", value: supplierKpis.approved, color: "#059669" },
            { label: "Recusadas", value: supplierKpis.rejected, color: "#e11d48" },
          ]}
        />
      ) : null}

      {isMasterService && serviceCounts ? (
        <StatusShareChart
          title="Pipeline Service por status (%)"
          items={SERVICE_PIPELINE_ORDER.map((status, index) => ({
            label: SERVICE_PIPELINE_LABELS[status],
            value: serviceCounts[status] ?? 0,
            color: ["#00aab3", "#c10089", "#00535a", "#059669", "#e11d48", "#9333ea"][index % 6]!,
          }))}
        />
      ) : null}

      {supplierKpis && supplierKpis.overdueDocuments > 0 ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {supplierKpis.overdueDocuments} documento(s) em atraso.{" "}
          <Link href="/app/compliance" className="font-semibold underline">
            Regularizar compliance
          </Link>
        </div>
      ) : null}

      <div className="rounded-2xl border border-black/5 bg-white/80 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">O que este perfil pode fazer</h2>
        <ul className="mt-4 space-y-2">
          {capabilities.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-neutral-700">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9333EA]" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
