import { DEFAULT_RIF_BRAND, type RifBrand } from "@/features/master-service/rif";
import { can, getPlanGate } from "@/features/billing/plan-gate";
import { firestoreDb } from "@/lib/firebase/firestore-db";

type ServiceClientBrand = {
  displayName: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
} | null;

/** Premium (whitelabel) ou Cota Service: logo/cores do solicitante; senão padrão CotaCondo. */
export async function resolveRifBrand(input: {
  organizationId: string;
  serviceClient?: ServiceClientBrand;
  organizationName?: string;
}): Promise<RifBrand> {
  if (input.serviceClient) {
    return {
      displayName: input.serviceClient.displayName || input.organizationName || "Cliente",
      primaryColor: input.serviceClient.primaryColor || DEFAULT_RIF_BRAND.primaryColor,
      secondaryColor: input.serviceClient.secondaryColor || DEFAULT_RIF_BRAND.secondaryColor,
      logoUrl: input.serviceClient.logoUrl || DEFAULT_RIF_BRAND.logoUrl,
      whitelabel: true,
    };
  }

  const gate = await getPlanGate(input.organizationId);
  const premiumWhitelabel = can(gate, "whitelabel") || can(gate, "rif") || can(gate, "cotaService");
  if (premiumWhitelabel) {
    const org = await firestoreDb.organization.findUnique({
      where: { id: input.organizationId },
      select: {
        name: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
      },
    });

    return {
      displayName: org?.name || input.organizationName || gate?.planName || "Solicitante",
      primaryColor:
        (org as { primaryColor?: string | null } | null)?.primaryColor ||
        DEFAULT_RIF_BRAND.primaryColor,
      secondaryColor:
        (org as { secondaryColor?: string | null } | null)?.secondaryColor ||
        DEFAULT_RIF_BRAND.secondaryColor,
      logoUrl: org?.logoUrl || DEFAULT_RIF_BRAND.logoUrl,
      whitelabel: true,
    };
  }

  return { ...DEFAULT_RIF_BRAND };
}
