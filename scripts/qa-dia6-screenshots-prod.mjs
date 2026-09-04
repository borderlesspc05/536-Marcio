import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.QA_BASE_URL || "https://536-marcio.vercel.app";
const OUT = path.resolve("artifacts/qa/screenshots/dia6");
const PASS = "123456";

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: file, fullPage: true });
  console.log("ok", name, page.url());
}

async function login(page, email) {
  await page.goto(`${BASE}/acesse`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 60000 });
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log("after login", email, page.url());
}

async function main() {
  await mkdir(OUT, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "msedge" });
  } catch {
    browser = await chromium.launch({ headless: true });
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);

  await login(page, "sindico@demo.cotacondo.com.br");
  await shot(page, "05-sindico-app-home-banners.png");
  if (page.url().includes("/app")) {
    await page.goto(`${BASE}/app/meu-plano`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await shot(page, "06-sindico-meu-plano.png");
    await page.goto(`${BASE}/app/indicacoes`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await shot(page, "07-sindico-indicacoes-copiar.png");
  }

  await context.clearCookies();
  await login(page, "fornecedor@demo.cotacondo.com.br");
  if (page.url().includes("/app")) {
    await page.goto(`${BASE}/app/oportunidades`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await shot(page, "08-fornecedor-kanban-totais.png");
    await page.goto(`${BASE}/app/meu-plano`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await shot(page, "09-fornecedor-meu-plano.png");
  } else {
    await shot(page, "08-fornecedor-login-fail.png");
  }

  await context.clearCookies();
  await login(page, "adm.master@demo.cotacondo.com.br");
  if (page.url().includes("/app")) {
    await page.goto(`${BASE}/app/financeiro`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await shot(page, "10-adm-financeiro-comissoes.png");
    await page.goto(`${BASE}/app/equipe`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await shot(page, "11-adm-equipe-aprovadores.png");
    await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await shot(page, "12-adm-app-banners-sidebar.png");
  } else {
    await shot(page, "10-adm-login-fail.png");
  }

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mobile.newPage();
  await mpage.goto(`${BASE}/fornecedores`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await mpage.waitForTimeout(1200);
  await mpage.screenshot({ path: path.join(OUT, "13-fornecedores-mobile.png"), fullPage: true });
  console.log("ok 13-fornecedores-mobile.png");

  await browser.close();
  console.log("DONE", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
