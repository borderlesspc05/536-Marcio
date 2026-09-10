import type { RifBrand, RifComparativeRow, RifQuotationContext } from "./rif";
import { DEFAULT_RIF_BRAND } from "./rif";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * HTML pronto para Word Online (copiar) ou impressão → PDF.
 * Fundo branco, texto preto; logo só na capa; rodapé By CotaCondo.
 */
export function renderRifHtmlDocument(input: {
  context: RifQuotationContext;
  averageCents: number;
  rows: RifComparativeRow[];
  brand?: RifBrand;
  aiInsights?: string | null;
  plainBody: string;
}): string {
  const brand = input.brand ?? DEFAULT_RIF_BRAND;
  const primary = brand.primaryColor || DEFAULT_RIF_BRAND.primaryColor;
  const secondary = brand.secondaryColor || DEFAULT_RIF_BRAND.secondaryColor;

  const rowsHtml = input.rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.supplierName)}</td>
        <td>${escapeHtml(row.marketYearsHint ?? "A informar")}</td>
        <td>${row.reclameAquiUrl ? `<a href="${escapeHtml(row.reclameAquiUrl)}">Perfil</a>` : "Não informado"}</td>
        <td>${row.googleProfileUrl ? `<a href="${escapeHtml(row.googleProfileUrl)}">Perfil</a>` : "Não informado"}</td>
        <td>${escapeHtml(row.observations ?? "")}</td>
      </tr>`,
    )
    .join("\n");

  const financialRows = input.rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.supplierName)}</td>
        <td>${formatBRL(row.amountCents)}</td>
        <td>${row.deltaPercent > 0 ? "+" : ""}${row.deltaPercent}% (${row.vsAverage})</td>
        <td>${escapeHtml(row.paymentTerms)}</td>
      </tr>`,
    )
    .join("\n");

  const logoBlock = brand.logoUrl
    ? `<img class="logo" src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.displayName)}" />`
    : `<div class="logo-fallback" style="color:${escapeHtml(primary)}">${escapeHtml(brand.displayName)}</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>RIF ${escapeHtml(input.context.publicId)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    @page { margin: 18mm 16mm 22mm; }
    body {
      margin: 0;
      font-family: Poppins, system-ui, sans-serif;
      color: #111;
      background: #fff;
      line-height: 1.45;
      font-size: 11pt;
    }
    .accent { color: ${escapeHtml(primary)}; }
    .bar { height: 6px; background: linear-gradient(90deg, ${escapeHtml(primary)}, ${escapeHtml(secondary)}); }
    .cover { padding: 28px 8px 18px; border-bottom: 1px solid #e5e7eb; margin-bottom: 22px; }
    .logo { max-height: 56px; max-width: 220px; object-fit: contain; }
    .logo-fallback { font-size: 22pt; font-weight: 700; }
    h1.section {
      font-size: 18pt;
      font-weight: 700;
      text-align: left;
      margin: 22px 0 10px;
      color: #111;
    }
    table.rif {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      text-align: left;
    }
    table.rif th, table.rif td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      vertical-align: top;
    }
    table.rif th { background: #f8fafc; }
    .footer {
      position: running(rifFooter);
      font-size: 8pt;
      color: #64748b;
    }
    @media print {
      .no-print { display: none !important; }
      .page-footer {
        position: fixed;
        left: 0; right: 0; bottom: 0;
        text-align: center;
        font-size: 8pt;
        color: #64748b;
        padding: 8px;
        border-top: 1px solid #e5e7eb;
        background: #fff;
      }
    }
    .page-footer {
      margin-top: 28px;
      text-align: center;
      font-size: 8pt;
      color: #64748b;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
    }
    .closing { margin-top: 28px; }
    pre.word {
      white-space: pre-wrap;
      font-family: Poppins, system-ui, sans-serif;
      font-size: 10pt;
      background: #fafafa;
      border: 1px dashed #cbd5e1;
      padding: 12px;
    }
  </style>
</head>
<body>
  <div class="bar"></div>
  <header class="cover">
    ${logoBlock}
    <p style="margin:12px 0 0;font-size:10pt;color:#64748b">By CotaCondo${
      brand.whitelabel ? ` · ${escapeHtml(brand.displayName)}` : ""
    }</p>
    <h1 style="font-size:20pt;margin:16px 0 6px">Análise RIF — ${escapeHtml(input.context.publicId)}</h1>
    <p style="margin:0;color:#334155">
      ${escapeHtml(input.context.condominiumName)} · ${escapeHtml(input.context.categoryName)} · ${escapeHtml(input.context.serviceName)}
    </p>
  </header>

  <p class="no-print" style="margin:0 0 16px">
    <button onclick="window.print()" style="background:${escapeHtml(primary)};color:#fff;border:0;border-radius:10px;padding:8px 14px;font-weight:600;cursor:pointer">
      Imprimir / Salvar PDF
    </button>
  </p>

  <h1 class="section">1. Objetivo</h1>
  <p>Equalizar e analisar as propostas da cotação <strong>${escapeHtml(input.context.publicId)}</strong> para o condomínio <strong>${escapeHtml(input.context.condominiumName)}</strong>, sob gestão de ${escapeHtml(input.context.requesterOrgName)}.</p>
  <p>${escapeHtml(input.context.description)}</p>

  <h1 class="section">2. RIF – Requisição de Informações de Fornecedores</h1>
  <table class="rif">
    <thead>
      <tr>
        <th>Nome</th>
        <th>Tempo de mercado</th>
        <th>Nota Reclame Aqui</th>
        <th>Nota Google</th>
        <th>Observações</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <h1 class="section">3. Equalização – RPF</h1>
  <p>Comparação de escopo, itens, prazos e garantias a partir das condições enviadas.</p>
  <table class="rif">
    <thead>
      <tr><th>Fornecedor</th><th>CAPEX</th><th>vs média</th><th>Pagamento</th></tr>
    </thead>
    <tbody>${financialRows}</tbody>
  </table>

  <h1 class="section">4. Análise Financeira (AF)</h1>
  <p>Média dos valores de implantação: <strong>${formatBRL(input.averageCents)}</strong>.</p>
  <p>OPEX (leitura mensal): equalizar reajustes e recorrência na negociação quando não vierem explícitos.</p>

  <h1 class="section">5. Condições de Pagamento</h1>
  <ul>
    ${input.rows.map((row) => `<li><strong>${escapeHtml(row.supplierName)}</strong>: ${escapeHtml(row.paymentTerms)}</li>`).join("")}
  </ul>

  <h1 class="section">6. Negociação</h1>
  <ul>
    <li>Contraoferta nas propostas acima da média, equalizando escopo e garantia.</li>
    <li>Esclarecer itens não cotados e exclusões de escopo.</li>
    <li>Condicionar aceite à regularidade de compliance.</li>
  </ul>

  <h1 class="section">7. Saving</h1>
  <p>Potencial de economia calculado em relação à média das propostas (ver recomendação).</p>

  <h1 class="section">8. Recomendação Final</h1>
  <p>Avaliar Melhor CAPEX, Melhor OPEX e robustez técnica (compliance + histórico).</p>
  ${
    input.aiInsights
      ? `<pre class="word">${escapeHtml(input.aiInsights)}</pre>`
      : ""
  }

  <h1 class="section">9. Encerramento</h1>
  <div class="closing">
    <p><strong>CotaCondo cotações inteligentes</strong></p>
    <p>Atenciosamente<br/>Equipe Compras${
      brand.whitelabel ? ` — ${escapeHtml(brand.displayName)}` : " — CotaCondo"
    }</p>
  </div>

  <h1 class="section no-print">Anexo — texto para Word Online</h1>
  <pre class="word no-print">${escapeHtml(input.plainBody)}</pre>

  <div class="page-footer">By CotaCondo</div>
</body>
</html>`;
}
