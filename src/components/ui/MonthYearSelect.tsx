"use client";

import { useId, useState } from "react";

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

type Props = {
  name?: string;
  defaultValue?: string | null;
  className?: string;
  allowEmpty?: boolean;
  yearsBack?: number;
  yearsForward?: number;
};

function parseYearMonth(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return { year: "", month: "" };
  const [year, month] = value.split("-");
  return { year, month };
}

function buildYearOptions(yearsBack: number, yearsForward: number) {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let year = current + yearsForward; year >= current - yearsBack; year -= 1) {
    years.push(year);
  }
  return years;
}

/** Substitui input type=month (ruim no Windows) por selects Mês + Ano → YYYY-MM. */
export function MonthYearSelect({
  name = "yearMonth",
  defaultValue,
  className = "",
  allowEmpty = true,
  yearsBack = 3,
  yearsForward = 2,
}: Props) {
  const initial = parseYearMonth(defaultValue);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const years = buildYearOptions(yearsBack, yearsForward);
  const uid = useId();
  const combined = month && year ? `${year}-${month}` : "";

  return (
    <div className={`flex min-w-0 flex-wrap gap-2 ${className}`} role="group" aria-label="Mês e ano">
      <select
        id={`${uid}-month`}
        value={month}
        aria-label="Mês"
        className="h-11 min-w-[148px] flex-1 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium"
        onChange={(event) => setMonth(event.target.value)}
      >
        {allowEmpty ? <option value="">Mês</option> : null}
        {MONTHS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <select
        id={`${uid}-year`}
        value={year}
        aria-label="Ano"
        className="h-11 min-w-[104px] flex-1 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium"
        onChange={(event) => setYear(event.target.value)}
      >
        {allowEmpty ? <option value="">Ano</option> : null}
        {years.map((item) => (
          <option key={item} value={String(item)}>
            {item}
          </option>
        ))}
      </select>

      <input type="hidden" name={name} value={combined} />
    </div>
  );
}
