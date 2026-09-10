import { redirect } from "next/navigation";
import type { MemberRole, OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import type { SessionPayload } from "@/lib/auth/session";
import {
  can,
  getPlanGate,
  type PlanFeatureKey,
  type PlanGateContext,
} from "@/features/billing/plan-gate";
import { AppError } from "@/lib/errors";

export type CapabilityOptions = {
  types?: OrganizationType[];
  roles?: MemberRole[];
  href?: string;
  /** Feature de plano; falha com AppError se ausente (actions) ou redirect (pages). */
  feature?: PlanFeatureKey;
  featureMessage?: string;
  /** Se true, redirect home em vez de throw (páginas). Default: throw para actions. */
  redirectOnDeny?: boolean;
};

/**
 * Seam Capability: sessão autorizada + feature de plano no mesmo lugar.
 */
export async function requireCapability(
  options: CapabilityOptions = {},
): Promise<{ session: SessionPayload; gate: PlanGateContext | null }> {
  const session = await requireAuthorizedSession({
    types: options.types,
    roles: options.roles,
    href: options.href,
  });

  let gate: PlanGateContext | null = null;
  if (options.feature) {
    gate = await getPlanGate(session.organizationId);
    if (!can(gate, options.feature)) {
      const message =
        options.featureMessage ??
        `Recurso "${options.feature}" indisponível no plano atual.`;
      if (options.redirectOnDeny) {
        redirect(session.role === "external_approver" ? "/app/aprovador/cotacoes" : "/app");
      }
      throw new AppError(message, "PLAN_FEATURE");
    }
  } else {
    gate = await getPlanGate(session.organizationId);
  }

  return { session, gate };
}

export async function requirePlanFeature(
  organizationId: string,
  feature: PlanFeatureKey,
  message?: string,
): Promise<PlanGateContext> {
  const gate = await getPlanGate(organizationId);
  if (!gate || !can(gate, feature)) {
    throw new AppError(
      message ?? `Recurso "${feature}" indisponível no plano atual.`,
      "PLAN_FEATURE",
    );
  }
  return gate;
}
