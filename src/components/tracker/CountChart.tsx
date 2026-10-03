import type { CountRow } from "@/lib/trackerStats";

/** Horizontal bar chart that always shows raw counts; percentages only when the base is large. */
export function CountChart({
  title,
  rows,
  percentOf,
  emptyText,
}: {
  title: string;
  rows: CountRow[];
  /** When set and ≥ 20, each row also shows its share of this total. */
  percentOf?: number;
  emptyText: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((s, r) => s + r.count, 0);
  const showPercent = percentOf !== undefined && percentOf >= 20;
  return (
    <figure className="card p-5">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2" aria-label={title}>
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 truncate text-muted-foreground">{r.label}</span>
              <div className="h-3 flex-1 rounded bg-muted" aria-hidden="true">
                <div
                  className="h-3 rounded bg-primary transition-[width] motion-reduce:transition-none"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
              <span className="w-14 text-right tabular-nums">
                {r.count}
                {showPercent && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {Math.round((r.count / percentOf!) * 100)}%
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
