type StatusShareItem = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  title?: string;
  items: StatusShareItem[];
};

/** Gráfico simples de percentual por status (CSS), alimentado pelos KPIs do dashboard. */
export function StatusShareChart({ title = "Distribuição por status", items }: Props) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const rows = items.map((item) => {
    const safe = Math.max(0, item.value);
    const pct = total > 0 ? Math.round((safe / total) * 100) : 0;
    return { ...item, value: safe, pct };
  });

  return (
    <section className="rounded-2xl border border-black/5 bg-white/90 p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-[#00535a]">{title}</h2>
        <p className="text-xs font-medium text-neutral-500">Total: {total}</p>
      </div>

      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
        {rows.map((row) =>
          row.pct > 0 ? (
            <div
              key={row.label}
              title={`${row.label}: ${row.pct}%`}
              style={{ width: `${row.pct}%`, backgroundColor: row.color }}
              className="h-full first:rounded-l-full last:rounded-r-full"
            />
          ) : null,
        )}
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
              <span className="truncate text-neutral-700">{row.label}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-[#00535a]">
              {row.value} · {row.pct}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
