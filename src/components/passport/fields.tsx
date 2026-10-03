import { useMemo, useState, type ReactNode } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Labelled field wrapper — label always above the input. */
export function F({
  id,
  label,
  hint,
  children,
  className = "",
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

/**
 * Searchable multi-select with a curated list plus free-text entry.
 * Selected values render as removable chips.
 */
export function MultiSelect({
  id,
  label,
  hint,
  options,
  values,
  onChange,
  placeholder = "Type to search or add your own…",
  max = 30,
}: {
  id: string;
  label: string;
  hint?: string;
  options: readonly string[];
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((option) => !values.includes(option))
      .filter((option) => !q || option.toLowerCase().includes(q))
      .slice(0, 8);
  }, [options, values, query]);
  const exact = query.trim();
  const canAddCustom =
    exact.length > 1 &&
    !values.some((value) => value.toLowerCase() === exact.toLowerCase()) &&
    !options.some((option) => option.toLowerCase() === exact.toLowerCase());

  const add = (value: string) => {
    if (values.length >= max) return;
    onChange([...values, value]);
    setQuery("");
  };

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label={`Selected ${label.toLowerCase()}`}>
          {values.map((value) => (
            <li key={value} className="chip chip-teal flex items-center gap-1">
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center"
                onClick={() => onChange(values.filter((item) => item !== value))}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        className="mt-2"
        value={query}
        placeholder={placeholder}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (matches[0]) add(matches[0]);
            else if (canAddCustom) add(exact);
          }
        }}
      />
      {query.trim() && (
        <ul className="mt-1 divide-y divide-border border border-border bg-card" role="listbox">
          {matches.map((option) => (
            <li key={option}>
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center px-3 text-left hover:bg-teal-soft focus-visible:bg-teal-soft"
                onClick={() => add(option)}
              >
                {option}
              </button>
            </li>
          ))}
          {canAddCustom && (
            <li>
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left hover:bg-teal-soft focus-visible:bg-teal-soft"
                onClick={() => add(exact)}
              >
                <Plus className="size-4" /> Add “{exact}”
              </button>
            </li>
          )}
          {!matches.length && !canAddCustom && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matching option.</li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Selectable chip row for categories. */
export function ChipRow({
  options,
  labels,
  values,
  onToggle,
}: {
  options: readonly string[];
  labels: Record<string, string>;
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((option) => {
        const active = values.includes(option);
        return (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            aria-pressed={active}
            onClick={() => onToggle(option)}
          >
            {active && <Check className="size-3.5" />}
            {labels[option] ?? option}
          </Button>
        );
      })}
    </div>
  );
}
