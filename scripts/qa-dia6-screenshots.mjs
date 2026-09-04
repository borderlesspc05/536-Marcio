import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.QA_BASE_URL || "http://localhost:3005";
const OUT = path.resolve("artifacts/qa/screenshots/dia6");
const PASS = "123456";

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.waitForTimeout(800);
  await page.screenshot({ path: file, fullPage: true });
  console.log("ok", name);
}

async function login(page, email) {
  await page.goto(`${BASE}/acesse`, { waitUntil: "networkidle", timeout: 120000 });
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', PASS);
  await Promise.all([
    page.waitForURL(/\/app/, { timeout: 120000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  // Prefer system Edge if Playwright Chromium isn't cached yet.
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "msedge" });
  } catch {
    browser = await chromium.launch({ headless: true });
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);

  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
  await shot(page, "01-home-desktop.png");

  await page.goto(`${BASE}/fornecedores`, { waitUntil: "networkidle", timeout: 120000 });
  await shot(page, "02-fornecedores-carrossel-planos.png");

  await page.goto(`${BASE}/cadastro`, { waitUntil: "networkidle", timeout: 120000 });
  await shot(page, "03-cadastro.png");

  // Síndico: sidebar contraste + banners + meu plano
  await login(page, "sindico@demo.cotacondo.com.br");
  await shot(page, "05-sindico-app-home-banners.png");
  await page.goto(`${BASE}/app/meu-plano`, { waitUntil: "networkidle", timeout: 120000 });
  await shot(page, "06-sindico-meu-plano.png");
  await page.goto(`${BASE}/app/indicacoes`, { waitUntil: "networkidle", timeout: 120000 });
  await shot(page, "07-sindico-indicacoes-copiar.png");

  // Logout via cookie clear
  await context.clearCookies();

  // Fornecedor: kanban totais
  await login(page, "fornecedor@demo.cotacondo.com.br");
  await page.goto(`${BASE}/app/oportunidades`, { waitUntil: "networkidle", timeout: 120000 });
  await shot(page, "08-fornecedor-kanban-totais.png");
  await page.goto(`${BASE}/app/meu-plano`, { waitUntil: "networkidle", timeout: 120000 });
  await shot(page, "09-fornecedor-meu-plano.png");

  await context.clearCookies();

  // Adm master: financeiro + equipe
  await login(page, "adm.master@demo.cotacondo.com.br");
  await page.goto(`${BASE}/app/financeiro`, { waitUntil: "networkidle", timeout: 120000 });
  await shot(page, "10-adm-financeiro-comissoes.png");
  await page.goto(`${BASE}/app/equipe`, { waitUntil: "networkidle", timeout: 120000 });
  await shot(page, "11-adm-equipe-aprovadores.png");
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle", timeout: 120000 });
  await shot(page, "12-adm-app-banners-sidebar.png");

  // Mobile fornecedores
  await context.clearCookies();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mobile.newPage();
  await mpage.goto(`${BASE}/fornecedores`, { waitUntil: "networkidle", timeout: 120000 });
  await mpage.waitForTimeout(800);
  await mpage.screenshot({
    path: path.join(OUT, "13-fornecedores-mobile.png"),
    fullPage: true,
  });
  console.log("ok 13-fornecedores-mobile.png");

  await browser.close();
  console.log("DONE", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
