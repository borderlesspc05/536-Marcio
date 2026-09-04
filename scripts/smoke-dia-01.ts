import { MemberRole, OrganizationType } from "../src/lib/domain/types";
import { canAccessHref, getNavItemsForSession } from "../src/features/navigation/menu";
import { firestoreDb } from "../src/lib/firebase/firestore-db";
import { verifyPassword } from "../src/lib/auth/password";

const BASE = "http://localhost:3000";

async function check(path: string, expectRedirectTo?: string) {
  const res = await fetch(BASE + path, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  console.log(path, "->", res.status, loc || "");
  if (expectRedirectTo && !loc.includes(expectRedirectTo)) {
    throw new Error(`Expected redirect to ${expectRedirectTo}, got ${loc}`);
  }
  if (!expectRedirectTo && res.status >= 400) {
    throw new Error(`Unexpected status for ${path}: ${res.status}`);
  }
}

async function main() {
  console.log("== Rotas públicas ==");
  for (const path of ["/", "/acesse", "/cadastro", "/confirmar", "/recuperar-senha", "/fornecedores"]) {
    await check(path);
  }

  console.log("== Rota protegida sem cookie ==");
  await check("/app", "/acesse");

  console.log("== Autorização por perfil ==");
  const cases = [
    {
      email: "sindico@demo.cotacondo.com.br",
      type: OrganizationType.sindico,
      role: MemberRole.master,
      allow: ["/app/condominios", "/app/cotacoes"],
      deny: ["/app/oportunidades", "/app/financeiro", "/app/plataforma"],
    },
    {
      email: "fornecedor@demo.cotacondo.com.br",
      type: OrganizationType.fornecedor,
      role: MemberRole.master,
      allow: ["/app/oportunidades", "/app/compliance"],
      deny: ["/app/condominios", "/app/financeiro"],
    },
    {
      email: "adm.master@demo.cotacondo.com.br",
      type: OrganizationType.administradora,
      role: MemberRole.master,
      allow: ["/app/financeiro", "/app/parcerias", "/app/equipe"],
      deny: ["/app/plataforma", "/app/oportunidades"],
    },
    {
      email: "adm.operacional@demo.cotacondo.com.br",
      type: OrganizationType.administradora,
      role: MemberRole.operational,
      allow: ["/app/equipe", "/app/cotacoes"],
      deny: ["/app/financeiro", "/app/parcerias"],
    },
    {
      email: "admin@cotacondo.com.br",
      type: OrganizationType.master_admin,
      role: MemberRole.master,
      allow: ["/app/plataforma"],
      deny: ["/app/financeiro", "/app/oportunidades"],
    },
    {
      email: "masterservice@demo.cotacondo.com.br",
      type: OrganizationType.master_service,
      role: MemberRole.master,
      allow: [
        "/app/service/cotacoes",
        "/app/service/clientes",
        "/app/service/relatorios",
        "/app/service/mercado",
      ],
      deny: ["/app/plataforma", "/app/financeiro", "/app/oportunidades"],
    },
  ] as const;

  for (const c of cases) {
    const user = await firestoreDb.user.findUnique({ where: { email: c.email } });
    if (!user?.emailVerifiedAt) throw new Error("user missing " + c.email);
    if (!(await verifyPassword("123456", user.passwordHash))) {
      throw new Error("password fail " + c.email);
    }
    for (const href of c.allow) {
      if (!canAccessHref(href, { organizationType: c.type, role: c.role })) {
        throw new Error(c.email + " should allow " + href);
      }
    }
    for (const href of c.deny) {
      if (canAccessHref(href, { organizationType: c.type, role: c.role })) {
        throw new Error(c.email + " should deny " + href);
      }
    }
    const menu = getNavItemsForSession({
      organizationType: c.type,
      role: c.role,
    }).map((item) => item.label);
    console.log(c.email, "=>", menu.join(", "));
  }

  const settings = await firestoreDb.platformSettings.findUnique({ where: { id: "default" } });
  const plans = await firestoreDb.plan.count();
  const marketing = await firestoreDb.marketingSettings.findUnique({ where: { id: "default" } });
  if (!settings || settings.freeQuotaSolicitante !== 15) {
    throw new Error("platform settings invalid");
  }
  if (plans < 7) throw new Error("plans missing");
  if (!marketing?.whatsappUrl) throw new Error("marketing settings missing");
  console.log("Seed settings OK (plans=", plans, ", franquia=", settings.freeQuotaSolicitante, ")");

  console.log("SMOKE DIA 1 OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await firestoreDb.$disconnect();
  });
