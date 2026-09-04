import { OrganizationType } from "@/lib/domain/types";

const PLAN_SLUGS_BY_ORGANIZATION: Partial<Record<OrganizationType, readonly string[]>> = {
  [OrganizationType.sindico]: ["sindico-free", "sindico-pago"],
  [OrganizationType.administradora]: [
    "adm-free",
    "adm-pago",
    "adm-premium",
    "cota-service",
  ],
  [OrganizationType.fornecedor]: [
    "fornecedor-free",
    "fornecedor-pro",
    "fornecedor-premium",
    "fornecedor-vip",
  ],
};

export function getPlanSlugsForOrganization(type: OrganizationType): readonly string[] {
  return PLAN_SLUGS_BY_ORGANIZATION[type] ?? [];
}

export function isPlanAvailableForOrganization(type: OrganizationType, planSlug: string): boolean {
  return getPlanSlugsForOrganization(type).includes(planSlug);
}
