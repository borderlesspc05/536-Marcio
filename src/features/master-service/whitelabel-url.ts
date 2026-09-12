const FALLBACK_HOST = "https://www.cotacondo.com.br";

/** URL pública curta do whitelabel por cliente: www.cotacondo.com.br/selladm */
export function publicWhitelabelUrl(slug: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? FALLBACK_HOST).replace(/\/$/, "");
  const clean = slug.replace(/^\/+|\/+$/g, "");
  return `${base}/${clean}`;
}

export function normalizeWhitelabelSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export const WHITELABEL_RESERVED_SLUGS = new Set([
  "acesse",
  "app",
  "api",
  "s",
  "checkout",
  "cadastro",
  "confirmar",
  "recuperar-senha",
  "redefinir-senha",
  "fornecedores",
  "brand",
  "templates",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);
