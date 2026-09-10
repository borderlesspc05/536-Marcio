import { redirect } from "next/navigation";
import { MemberRole, type OrganizationType } from "@/lib/domain/types";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { canAccessHref } from "@/features/navigation/menu";

function defaultAppHome(session: SessionPayload): string {
  return session.role === MemberRole.external_approver
    ? "/app/aprovador/cotacoes"
    : "/app";
}

export async function requireAuthorizedSession(options?: {
  types?: OrganizationType[];
  roles?: MemberRole[];
  href?: string;
  /** Quando true, menu/href também valida features de plano. */
  checkFeatures?: boolean;
}): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/acesse?next=/app");
  }

  const home = defaultAppHome(session);

  if (
    options?.href &&
    !canAccessHref(options.href, session, { checkFeatures: options.checkFeatures === true })
  ) {
    redirect(home);
  }

  if (options?.types && !options.types.includes(session.organizationType)) {
    redirect(home);
  }

  if (options?.roles && !options.roles.includes(session.role)) {
    redirect(home);
  }

  return session;
}

export { requireCapability, requirePlanFeature } from "@/lib/auth/capability";
