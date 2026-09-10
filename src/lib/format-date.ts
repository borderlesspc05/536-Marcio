/** Formata data vinda de Date, ISO string ou Timestamp-like sem quebrar a página. */
export function formatDateTimePt(value: Date | string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}
