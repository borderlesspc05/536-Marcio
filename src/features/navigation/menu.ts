import { MemberRole, OrganizationType } from "@/lib/domain/types";
import type { PlanFeatureKey, PlanFeatures } from "@/features/billing/plan-gate";
import {
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  Handshake,
  LayoutDashboard,
  LineChart,
  Palette,
  Settings,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: MemberRole[];
  types?: OrganizationType[];
  feature?: PlanFeatureKey;
  financialOnly?: boolean;
};

const ALL_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/app",
    icon: LayoutDashboard,
  },
  {
    label: "Minhas Cotações",
    href: "/app/aprovador/cotacoes",
    icon: ClipboardList,
    roles: [MemberRole.external_approver],
  },
  {
    label: "Calendário",
    href: "/app/aprovador/calendario",
    icon: CalendarDays,
    roles: [MemberRole.external_approver],
  },
  {
    label: "Calendário",
    href: "/app/calendario",
    icon: CalendarDays,
    types: [OrganizationType.administradora, OrganizationType.sindico],
  },
  {
    label: "Calendário Service",
    href: "/app/service/calendario",
    icon: CalendarDays,
    types: [OrganizationType.master_service],
  },
  {
    label: "Condomínios",
    href: "/app/condominios",
    icon: Building2,
    types: [OrganizationType.sindico, OrganizationType.administradora],
  },
  {
    label: "Cotações",
    href: "/app/cotacoes",
    icon: ClipboardList,
    types: [OrganizationType.sindico, OrganizationType.administradora],
  },
  {
    label: "Oportunidades",
    href: "/app/oportunidades",
    icon: ClipboardList,
    types: [OrganizationType.fornecedor],
  },
  {
    label: "Compliance",
    href: "/app/compliance",
    icon: FileCheck2,
    types: [OrganizationType.fornecedor],
  },
  {
    label: "Meu Plano",
    href: "/app/meu-plano",
    icon: Wallet,
    types: [
      OrganizationType.fornecedor,
      OrganizationType.sindico,
      OrganizationType.administradora,
    ],
  },
  {
    label: "Migração",
    href: "/app/migracao",
    icon: Building2,
    types: [OrganizationType.sindico],
  },
  {
    label: "Parcerias",
    href: "/app/parcerias",
    icon: Handshake,
    types: [OrganizationType.administradora],
    feature: "partnerships",
  },
  {
    label: "Financeiro",
    href: "/app/financeiro",
    icon: Wallet,
    types: [OrganizationType.administradora],
    roles: [MemberRole.master],
    financialOnly: true,
  },
  {
    label: "Indicações",
    href: "/app/indicacoes",
    icon: Users,
    types: [
      OrganizationType.administradora,
      OrganizationType.sindico,
      OrganizationType.fornecedor,
    ],
  },
  {
    label: "Equipe",
    href: "/app/equipe",
    icon: Users,
    types: [OrganizationType.administradora],
  },
  {
    label: "Notificações",
    href: "/app/notificacoes",
    icon: Bell,
  },
  {
    label: "Plataforma",
    href: "/app/plataforma",
    icon: Shield,
    types: [OrganizationType.master_admin],
  },
  {
    label: "Catálogo",
    href: "/app/plataforma/catalogo",
    icon: ClipboardList,
    types: [OrganizationType.master_admin],
  },
  {
    label: "Compliance",
    href: "/app/plataforma/compliance",
    icon: FileCheck2,
    types: [OrganizationType.master_admin],
  },
  {
    label: "Banners",
    href: "/app/plataforma/banners",
    icon: ClipboardList,
    types: [OrganizationType.master_admin],
  },
  {
    label: "Pipeline Service",
    href: "/app/service/cotacoes",
    icon: ClipboardList,
    types: [OrganizationType.master_service],
  },
  {
    label: "Clientes Service",
    href: "/app/service/clientes",
    icon: Palette,
    types: [OrganizationType.master_service],
  },
  {
    label: "Relatórios Service",
    href: "/app/service/relatorios",
    icon: LineChart,
    types: [OrganizationType.master_service],
  },
  {
    label: "Mercado",
    href: "/app/service/mercado",
    icon: LineChart,
    types: [OrganizationType.master_service],
  },
  {
    label: "Configurações",
    href: "/app/configuracoes",
    icon: Settings,
  },
];

export function canAccessNavItem(
  item: NavItem,
  input: {
    organizationType: OrganizationType;
    role: MemberRole;
    features?: PlanFeatures;
  },
  options?: { checkFeatures?: boolean },
): boolean {
  if (input.role === MemberRole.external_approver) {
    if (item.href === "/app/notificacoes" || item.href === "/app/configuracoes") {
      return true;
    }
    return item.roles?.includes(MemberRole.external_approver) ?? false;
  }

  if (item.roles?.includes(MemberRole.external_approver)) {
    return false;
  }

  if (item.types && !item.types.includes(input.organizationType)) {
    return false;
  }
  if (item.roles && !item.roles.includes(input.role)) {
    return false;
  }
  if (item.financialOnly && input.role !== MemberRole.master) {
    return false;
  }
  if (
    (options?.checkFeatures ?? true) &&
    item.feature &&
    !input.features?.[item.feature]
  ) {
    return false;
  }
  return true;
}

export function canAccessHref(
  href: string,
  input: {
    organizationType: OrganizationType;
    role: MemberRole;
    features?: PlanFeatures;
  },
  options?: { checkFeatures?: boolean },
): boolean {
  if (input.role === MemberRole.external_approver) {
    return (
      href.startsWith("/app/aprovador") ||
      href === "/app/notificacoes" ||
      href === "/app/configuracoes"
    );
  }

  const item = ALL_ITEMS.find((navItem) => navItem.href === href);
  if (!item) return true;
  return canAccessNavItem(item, input, options);
}

export function getNavItemsForSession(input: {
  organizationType: OrganizationType;
  role: MemberRole;
  features?: PlanFeatures;
}): NavItem[] {
  return ALL_ITEMS.filter((item) => canAccessNavItem(item, input));
}

export function profileLabel(type: OrganizationType, role: MemberRole): string {
  if (role === MemberRole.external_approver) return "Aprovador Externo";
  if (type === OrganizationType.master_admin) return "Master Admin";
  if (type === OrganizationType.master_service) return "Master Service";
  if (type === OrganizationType.fornecedor) return "Fornecedor";
  if (type === OrganizationType.sindico) return "Síndico";
  if (type === OrganizationType.administradora) {
    return role === MemberRole.master ? "Administradora · Master" : "Administradora · Operacional";
  }
  return "Usuário";
}
