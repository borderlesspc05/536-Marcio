/** Status operacional exibido ao fornecedor (sem revelar a data crua de validade). */

export type ComplianceValidityTone = "em_dia" | "atencao" | "vencido" | "em_analise" | "negada";

export type ComplianceValidityView = {
  tone: ComplianceValidityTone;
  label: string;
  daysRemaining: number | null;
  daysLabel: string | null;
  className: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function getComplianceValidityView(input: {
  status: string;
  validUntil: Date | string;
  now?: Date;
}): ComplianceValidityView {
  const now = input.now ?? new Date();
  const validUntil =
    input.validUntil instanceof Date ? input.validUntil : new Date(input.validUntil);

  if (input.status === "em_analise") {
    return {
      tone: "em_analise",
      label: "Em análise",
      daysRemaining: null,
      daysLabel: null,
      className: "bg-amber-50 text-amber-800",
    };
  }
  if (input.status === "negada") {
    return {
      tone: "negada",
      label: "Negada",
      daysRemaining: null,
      daysLabel: null,
      className: "bg-neutral-100 text-neutral-700",
    };
  }

  const end = new Date(validUntil);
  end.setHours(23, 59, 59, 999);
  const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / DAY_MS);

  if (daysRemaining < 0 || input.status === "em_atraso") {
    return {
      tone: "vencido",
      label: "Vencido",
      daysRemaining,
      daysLabel: `${daysRemaining} dia(s)`,
      className: "bg-red-50 text-red-800",
    };
  }

  if (daysRemaining <= 15) {
    return {
      tone: "atencao",
      label: "Atenção",
      daysRemaining,
      daysLabel: `${daysRemaining} dia(s) restantes`,
      className: "bg-amber-50 text-amber-900",
    };
  }

  return {
    tone: "em_dia",
    label: "Em dia",
    daysRemaining,
    daysLabel: `${daysRemaining} dia(s) restantes`,
    className: "bg-emerald-50 text-emerald-800",
  };
}
