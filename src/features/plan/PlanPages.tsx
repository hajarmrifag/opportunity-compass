import { useMemo, useState } from "react";
import { ApplicationPlan } from "./ApplicationPlan";
import { runPlanSelfChecks } from "./selfCheck";
import { BLACKROCK_PLAN } from "./seedData";
import type { TrackerState } from "./types";

/** Route suggestion: /plan-tests (team only). Every row should say Pass. */
export function PlanSelfCheckPage() {
  const results = useMemo(() => runPlanSelfChecks(), []);
  const passed = results.filter((r) => r.pass).length;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Self-check: application plan and CV studio</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {passed} of {results.length} checks pass.
      </p>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-2">Check</th>
            <th className="py-2 pr-2">Expected</th>
            <th className="py-2 pr-2">Actual</th>
            <th className="py-2">Result</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.name} className="border-b align-top">
              <td className="py-2 pr-2">{r.name}</td>
              <td className="py-2 pr-2">{r.expected}</td>
              <td className="py-2 pr-2 tabular-nums">{r.actual}</td>
              <td className={`py-2 font-medium ${r.pass ? "text-green-700" : "text-red-700"}`}>{r.pass ? "Pass" : "Fail"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

/** Route suggestion: /plan-demo. In the app, use the real opportunity and tracker record instead. */
export function PlanDemoPage() {
  const [tracker, setTracker] = useState<TrackerState>({ status: "preparing" });
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">{BLACKROCK_PLAN.title}</h1>
      <ApplicationPlan
        opportunity={BLACKROCK_PLAN}
        tracker={tracker}
        onMarkSubmitted={() => setTracker({ status: "submitted", submittedAt: new Date().toISOString().slice(0, 10) })}
      />
    </main>
  );
}
