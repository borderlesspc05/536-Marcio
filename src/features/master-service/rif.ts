export type RifBrand = {
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  whitelabel: boolean;
};

export type RifSupplierInput = {
  proposalId: string;
  supplierName: string;
  amountCents: number;
  paymentTerms: string;
  googleProfileUrl?: string | null;
  reclameAquiUrl?: string | null;
  marketYearsHint?: string | null;
  observations?: string | null;
  attachmentNames?: string[];
};

export type RifQuotationContext = {
  publicId: string;
  condominiumName: string;
  categoryName: string;
  serviceName: string;
  description: string;
  requesterOrgName: string;
};

export type RifComparativeRow = {
  proposalId: string;
  supplierName: string;
  amountCents: number;
  paymentTerms: string;
  vsAverage: "acima" | "abaixo" | "na_media";
  deltaPercent: number;
  googleProfileUrl?: string | null;
  reclameAquiUrl?: string | null;
  marketYearsHint?: string;
  observations?: string;
  attachmentNames?: string[];
};

export const RIF_MIN_PROPOSALS = 2;

export const DEFAULT_RIF_BRAND: RifBrand = {
  displayName: "CotaCondo",
  primaryColor: "#c10089",
  secondaryColor: "#00aab3",
  logoUrl: "/brand/logo-transparent-v2.png",
  whitelabel: false,
};

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function buildRifComparative(
  proposals: Array<{
    id: string;
    organization: {
      name: string;
      googleProfileUrl?: string | null;
      reclameAquiUrl?: string | null;
    };
    conditions: Array<{ amountCents: number; paymentTerms: string }>;
    attachments?: Array<{ fileName: string }>;
  }>,
): { averageCents: number; rows: RifComparativeRow[]; suppliers: RifSupplierInput[] } {
  const priced = proposals
    .map((proposal) => {
      const best = [...proposal.conditions].sort((a, b) => a.amountCents - b.amountCents)[0];
      if (!best) return null;
      const attachmentNames =
        proposal.attachments?.map((item) => item.fileName) ??
        [];
      return {
        proposalId: proposal.id,
        supplierName: proposal.organization.name,
        amountCents: best.amountCents,
        paymentTerms: best.paymentTerms,
        googleProfileUrl: proposal.organization.googleProfileUrl ?? null,
        reclameAquiUrl: proposal.organization.reclameAquiUrl ?? null,
        marketYearsHint: "A informar (proposta / pesquisa aberta)",
        observations: `Condição: ${best.paymentTerms}. Anexos: ${
          attachmentNames.length ? attachmentNames.join(", ") : "nenhum"
        }.`,
        attachmentNames,
      } satisfies RifSupplierInput;
    })
    .filter(Boolean) as RifSupplierInput[];

  if (priced.length === 0) {
    return { averageCents: 0, rows: [], suppliers: [] };
  }

  const averageCents = Math.round(
    priced.reduce((sum, row) => sum + row.amountCents, 0) / priced.length,
  );

  const rows: RifComparativeRow[] = priced.map((row) => {
    const deltaPercent =
      averageCents === 0
        ? 0
        : Math.round(((row.amountCents - averageCents) / averageCents) * 1000) / 10;
    const vsAverage: RifComparativeRow["vsAverage"] =
      Math.abs(deltaPercent) < 1 ? "na_media" : deltaPercent > 0 ? "acima" : "abaixo";
    return {
      ...row,
      vsAverage,
      deltaPercent,
      marketYearsHint: row.marketYearsHint ?? "A informar",
      observations: row.observations ?? "",
    };
  });

  return { averageCents, rows, suppliers: priced };
}

/** Relatório executivo no modelo padrão RIF (texto Poppins / Word Online). */
export function buildRifExecutiveDocument(input: {
  context: RifQuotationContext;
  averageCents: number;
  rows: RifComparativeRow[];
  brand: RifBrand;
}): { markdown: string; plainForWord: string } {
  const { context, averageCents, rows, brand } = input;
  const bestCapex = [...rows].sort((a, b) => a.amountCents - b.amountCents)[0];
  const bestPayment = [...rows].sort((a, b) =>
    a.paymentTerms.localeCompare(b.paymentTerms, "pt-BR"),
  )[0];
  const potentialSavingCents = bestCapex
    ? Math.max(0, averageCents - bestCapex.amountCents)
    : 0;

  const section = (title: string, body: string[]) => [`**${title}**`, "", ...body, ""];

  const plainParts = [
    ...section("1. Objetivo", [
      `Equalizar e analisar as propostas da cotação ${context.publicId} (${context.categoryName} · ${context.serviceName}) para o condomínio ${context.condominiumName}, sob gestão de ${context.requesterOrgName}.`,
      `Escopo solicitado: ${context.description.slice(0, 500)}${context.description.length > 500 ? "…" : ""}`,
    ]),
    ...section("2. RIF – Requisição de Informações de Fornecedores", [
      "Nome | Tempo de mercado | Nota Reclame Aqui | Nota Google | Observações",
      "---|---|---|---|---",
      ...rows.map((row) => {
        const ra = row.reclameAquiUrl ? "Ver perfil" : "Não informado";
        const google = row.googleProfileUrl ? "Ver perfil" : "Não informado";
        return `${row.supplierName} | ${row.marketYearsHint ?? "A informar"} | ${ra} | ${google} | ${(row.observations ?? "").replace(/\n/g, " ")}`;
      }),
    ]),
    ...section("3. Equalização – RPF", [
      "Comparativo de escopo, itens, prazos e garantias a partir das condições enviadas:",
      ...rows.map(
        (row) =>
          `- ${row.supplierName}: CAPEX ${formatBRL(row.amountCents)}; pagamento: ${row.paymentTerms}; vs média: ${row.deltaPercent > 0 ? "+" : ""}${row.deltaPercent}% (${row.vsAverage}).`,
      ),
    ]),
    ...section("4. Análise Financeira (AF)", [
      `Média dos valores de implantação: ${formatBRL(averageCents)}.`,
      ...rows.map(
        (row) =>
          `- ${row.supplierName}: ${formatBRL(row.amountCents)} (${row.deltaPercent > 0 ? "+" : ""}${row.deltaPercent}% vs média).`,
      ),
      "OPEX (leitura mensal): não discriminado de forma uniforme nas propostas — validar reajustes e recorrência na negociação.",
    ]),
    ...section("5. Condições de Pagamento", [
      ...rows.map((row) => `- ${row.supplierName}: ${row.paymentTerms}`),
      bestPayment
        ? `Destaque de flexibilidade aparente: ${bestPayment.supplierName} (${bestPayment.paymentTerms}).`
        : "",
    ]),
    ...section("6. Negociação", [
      "Sugerir contraoferta nas propostas acima da média, equalizando escopo e prazo de garantia.",
      "Pedir esclarecimento de itens não cotados e eventuais exclusões de escopo.",
      "Condicionar aceite à regularidade de compliance documental.",
    ]),
    ...section("7. Saving", [
      potentialSavingCents > 0
        ? `Saving potencial vs média ao priorizar a melhor CAPEX: ${formatBRL(potentialSavingCents)}.`
        : "Saving adicional depende de rodada de negociação (propostas já próximas da média).",
    ]),
    ...section("8. Recomendação Final", [
      bestCapex
        ? `Melhor CAPEX: ${bestCapex.supplierName} (${formatBRL(bestCapex.amountCents)}).`
        : "Sem base suficiente para CAPEX.",
      "Melhor OPEX: a confirmar após equalização de recorrência/reajuste.",
      "Melhor robustez técnica: priorizar fornecedor com compliance aprovado, histórico positivo e menor risco de escopo incompleto.",
      bestCapex
        ? `Indicação preliminar (sujeita a validação técnica): ${bestCapex.supplierName}.`
        : "",
    ]),
    ...section("9. Encerramento", [
      "Documento gerado para apoio à decisão de compras condominiais.",
      "",
      "CotaCondo cotações inteligentes",
      "",
      "Atenciosamente",
      `Equipe Compras${brand.whitelabel ? ` — ${brand.displayName}` : " — CotaCondo"}`,
    ]),
  ].filter(Boolean);

  const markdown = [
    `# Análise RIF — ${context.publicId}`,
    "",
    `*By ${brand.displayName}*`,
    "",
    ...plainParts,
  ].join("\n");

  const plainForWord = [
    "Fonte sugerida: Poppins. Títulos de seção em negrito (≈18 pt). Tabela RIF ≈9 pt.",
    "",
    ...plainParts,
    "",
    "— Rodapé em todas as páginas: By CotaCondo",
  ].join("\n");

  return { markdown, plainForWord };
}

/** Stub LLM — só deve ser chamado com ≥2 propostas (economia de token). */
export async function generateAiRifInsights(input: {
  mode: "platform" | "client";
  comparativeMarkdown: string;
}): Promise<string> {
  const source = input.mode === "client" ? "API do cliente" : "API da plataforma";
  return [
    `Insights via ${source} (estrutura preparada para modelo LLM).`,
    "Priorize propostas abaixo da média com condições compatíveis ao fluxo de caixa.",
    "Valide compliance e histórico (Google / Reclame Aqui) antes do aceite.",
    "",
    "---",
    input.comparativeMarkdown.slice(0, 800),
  ].join("\n");
}
