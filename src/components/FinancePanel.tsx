import { useMemo, useState } from "react";
import type {
  FinanceCost,
  FinanceScenario,
  FinanceSupport,
  FinanceTiming,
  MoneyPeriod,
} from "@/domain/types";
import { Button } from "@/components/ui/button";
import { calculateAffordability, emptyFinanceScenario } from "@/lib/finance";
import { uid, useStore } from "@/lib/store";
import { safeHttpUrl } from "@/lib/validation";

const periods: MoneyPeriod[] = ["one_time", "monthly", "yearly", "programme"];
const timings: FinanceTiming[] = [
  "upfront",
  "ongoing",
  "later_reimbursement",
  "refundable_deposit",
];
const pretty = (value: string) => value.replaceAll("_", " ");
const money = (currency: string, value: number) =>
  `${currency} ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}`;

const makeCost = (): FinanceCost => ({
  id: uid(),
  label: "",
  amount: null,
  currency: "HKD",
  period: "programme",
  component: "tuition",
  timing: "upfront",
  knowledge: "estimated",
  source: "user_estimate",
  sourceUrl: null,
  required: true,
});
const makeSupport = (): FinanceSupport => ({
  id: uid(),
  label: "",
  amount: null,
  currency: "HKD",
  period: "programme",
  component: "tuition",
  timing: "upfront",
  knowledge: "estimated",
  source: "user_estimate",
  sourceUrl: null,
  kind: "cash",
  award: "confirmed",
  applicable: true,
});

export function FinancePanel({ opportunityId }: { opportunityId: string }) {
  const { getFinanceScenario, saveFinanceScenario } = useStore();
  const stored = getFinanceScenario(opportunityId);
  const [draft, setDraft] = useState<FinanceScenario>(
    () => stored ?? emptyFinanceScenario(opportunityId),
  );
  const [saved, setSaved] = useState("");
  const result = useMemo(() => calculateAffordability(draft), [draft]);
  const changeCost = (id: string, patch: Partial<FinanceCost>) => {
    setSaved("");
    setDraft((current) => ({
      ...current,
      costs: current.costs.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };
  const changeSupport = (id: string, patch: Partial<FinanceSupport>) => {
    setSaved("");
    setDraft((current) => ({
      ...current,
      supports: current.supports.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };
  return (
    <section
      className="atlas-finance-panel border-y border-foreground py-8"
      aria-labelledby="affordability"
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="atlas-kicker">Your private scenario</p>
          <h2 id="affordability" className="text-3xl md:text-4xl">
            Affordability
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Manual planning only. These entries stay in this browser and never replace the
            provider's sourced funding facts.
          </p>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            No reviewed cost rows exist for this opportunity yet, so your local scenario is used.
            Being eligible is not the same as being awarded: only an actual award with a known
            amount lowers the base case; everything else appears under "If awarded".
          </p>
        </div>
        <Button
          onClick={() => {
            saveFinanceScenario(draft);
            setSaved("Scenario saved in this browser");
          }}
        >
          Save scenario
        </Button>
      </div>
      <p className="mt-2 text-xs text-success" aria-live="polite">
        {saved}
      </p>

      <FinanceList
        title="Costs"
        addLabel="Add cost"
        onAdd={() => setDraft((current) => ({ ...current, costs: [...current.costs, makeCost()] }))}
      >
        {draft.costs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No costs entered. Missing costs are not treated as zero.
          </p>
        )}
        {draft.costs.map((item) => (
          <CostRow
            key={item.id}
            item={item}
            onChange={(patch) => changeCost(item.id, patch)}
            onRemove={() =>
              setDraft((current) => ({
                ...current,
                costs: current.costs.filter((cost) => cost.id !== item.id),
              }))
            }
          />
        ))}
      </FinanceList>
      <FinanceList
        title="Funding & support"
        addLabel="Add support"
        onAdd={() =>
          setDraft((current) => ({ ...current, supports: [...current.supports, makeSupport()] }))
        }
      >
        {draft.supports.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No support entered. Conditional awards are always shown separately.
          </p>
        )}
        {draft.supports.map((item) => (
          <SupportRow
            key={item.id}
            item={item}
            onChange={(patch) => changeSupport(item.id, patch)}
            onRemove={() =>
              setDraft((current) => ({
                ...current,
                supports: current.supports.filter((support) => support.id !== item.id),
              }))
            }
          />
        ))}
      </FinanceList>

      <div className="mt-8">
        <h3 className="text-2xl">Scenario result</h3>
        {result.groups.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Add a cost or support amount to calculate a scenario.
          </p>
        ) : (
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {result.groups.map((group) => (
              <article
                key={`${group.currency}-${group.period}`}
                className="border border-foreground bg-card p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-lg">
                    {group.currency} · {pretty(group.period)}
                  </h4>
                  {group.totalUnknown && <span className="chip chip-unknown">Total unknown</span>}
                </div>
                <dl className="mt-4 divide-y divide-border">
                  <Result
                    label="Known subtotal"
                    value={money(group.currency, group.knownCostSubtotal)}
                  />
                  <Result
                    label="Total cost"
                    value={
                      group.totalUnknown
                        ? "Unknown"
                        : money(group.currency, group.knownCostSubtotal)
                    }
                  />
                  <Result
                    label="Base case · eventual gap"
                    value={money(group.currency, group.baseEventualGap)}
                    strong
                  />
                  <Result
                    label="If awarded · eventual gap"
                    value={money(group.currency, group.ifAwardedGap)}
                  />
                  <Result
                    label="Upfront cash need"
                    value={money(group.currency, group.upfrontNeed)}
                    strong
                  />
                </dl>
                {group.totalUnknown && (
                  <p className="mt-3 text-sm text-warning-strong">
                    Overall total is Unknown because required{" "}
                    {group.unknownComponents.map(pretty).join(", ")} cost is missing.
                  </p>
                )}
                <details className="mt-4 text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-semibold">
                    How this was calculated
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {group.arithmetic.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        )}
        {result.incompatible && (
          <p role="note" className="mt-3 bg-warning-soft p-3 text-sm">
            Currencies or periods differ, so they are shown separately. No conversion or
            cross-period total was made.
          </p>
        )}
      </div>
    </section>
  );
}

function FinanceList({
  title,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xl">{title}</h3>
        <Button variant="outline" size="sm" onClick={onAdd}>
          {addLabel}
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SharedFields({
  item,
  onChange,
}: {
  item: FinanceCost | FinanceSupport;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  return (
    <>
      <Field label="Label">
        <input
          value={item.label}
          maxLength={100}
          placeholder="e.g. Published tuition"
          onChange={(event) => onChange({ label: event.target.value })}
        />
      </Field>
      <Field label="Amount">
        <input
          inputMode="decimal"
          type="number"
          min="0"
          step="0.01"
          value={item.amount ?? ""}
          placeholder="Unknown"
          onChange={(event) =>
            onChange({ amount: event.target.value === "" ? null : Number(event.target.value) })
          }
        />
      </Field>
      <Field label="Currency">
        <input
          value={item.currency}
          maxLength={3}
          onChange={(event) => onChange({ currency: event.target.value.toUpperCase() })}
        />
      </Field>
      <Field label="Period">
        <select value={item.period} onChange={(event) => onChange({ period: event.target.value })}>
          {periods.map((value) => (
            <option key={value} value={value}>
              {pretty(value)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Component">
        <select
          value={item.component}
          onChange={(event) => onChange({ component: event.target.value })}
        >
          {["tuition", "living", "travel", "other"].map((value) => (
            <option key={value} value={value}>
              {pretty(value)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Timing">
        <select value={item.timing} onChange={(event) => onChange({ timing: event.target.value })}>
          {timings.map((value) => (
            <option key={value} value={value}>
              {pretty(value)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select
          value={item.knowledge}
          onChange={(event) =>
            onChange({
              knowledge: event.target.value,
              amount: event.target.value === "unknown" ? null : item.amount,
            })
          }
        >
          {["known", "estimated", "unknown"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Evidence">
        <select
          value={item.source}
          onChange={(event) =>
            onChange({
              source: event.target.value,
              sourceUrl: event.target.value === "user_estimate" ? null : item.sourceUrl,
            })
          }
        >
          <option value="user_estimate">User estimate</option>
          <option value="source_url">Source URL</option>
        </select>
      </Field>
      {item.source === "source_url" && (
        <Field label="Source URL">
          <input
            type="url"
            value={item.sourceUrl ?? ""}
            aria-invalid={!!item.sourceUrl && !safeHttpUrl(item.sourceUrl)}
            onChange={(event) => onChange({ sourceUrl: event.target.value || null })}
          />
        </Field>
      )}
    </>
  );
}

function CostRow({
  item,
  onChange,
  onRemove,
}: {
  item: FinanceCost;
  onChange: (patch: Partial<FinanceCost>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="atlas-finance-row border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SharedFields item={item} onChange={onChange} />
        <label className="flex items-center gap-2 self-end normal-case">
          <input
            className="w-auto"
            type="checkbox"
            checked={item.required}
            onChange={(event) => onChange({ required: event.target.checked })}
          />
          Required cost
        </label>
      </div>
      <Button className="mt-3" variant="ghost" size="sm" onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}
function SupportRow({
  item,
  onChange,
  onRemove,
}: {
  item: FinanceSupport;
  onChange: (patch: Partial<FinanceSupport>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="atlas-finance-row border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SharedFields item={item} onChange={onChange} />
        <Field label="Support type">
          <select
            value={item.kind}
            onChange={(event) => onChange({ kind: event.target.value as FinanceSupport["kind"] })}
          >
            <option value="waiver">Direct waiver / coverage</option>
            <option value="cash">Cash support</option>
            <option value="reimbursement">Reimbursement</option>
          </select>
        </Field>
        <Field label="Award status">
          <select
            value={item.award}
            onChange={(event) => onChange({ award: event.target.value as FinanceSupport["award"] })}
          >
            <option value="confirmed">Actual award I received</option>
            <option value="conditional">Possible / competitive (if awarded)</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end normal-case">
          <input
            className="w-auto"
            type="checkbox"
            checked={item.applicable}
            onChange={(event) => onChange({ applicable: event.target.checked })}
          />
          Applies to this scenario
        </label>
      </div>
      <Button className="mt-3" variant="ghost" size="sm" onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
function Result({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-display text-xl" : "font-semibold"}>{value}</dd>
    </div>
  );
}
