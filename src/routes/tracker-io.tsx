import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, uid, type ImportPlanItem } from "@/lib/store";
import { CsvError, parseCsv } from "@/lib/csv";
import {
  actionFor,
  autoMap,
  exportCsv,
  REQUIRED_FIELDS,
  templateCsv,
  TRACKER_FIELDS,
  validateRows,
  MAX_ROWS,
  type DuplicatePolicy,
  type ImportAction,
  type Mapping,
} from "@/lib/trackerCsv";
import { Loading, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/tracker-io")({
  head: () => ({
    meta: [
      { title: "Import & export tracker — OpportunityOS" },
      {
        name: "description",
        content: "Import or export your application tracker as a CSV spreadsheet.",
      },
      { property: "og:title", content: "Import & export tracker — OpportunityOS" },
      {
        property: "og:description",
        content: "Import or export your application tracker as a CSV spreadsheet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrackerIO,
});

const MAX_BYTES = 1_000_000;

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ACTION_LABEL: Record<ImportAction, { t: string; cls: string }> = {
  create: { t: "Add new", cls: "chip-met" },
  track: { t: "Track existing", cls: "chip-teal" },
  update: { t: "Update", cls: "chip-unknown" },
  skip: { t: "Skip", cls: "chip-muted" },
  invalid: { t: "Error", cls: "chip-notmet" },
};

function TrackerIO() {
  const { ready, applications, opportunities, importTracker } = useStore();
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [body, setBody] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [policy, setPolicy] = useState<DuplicatePolicy>("skip");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [confirming, setConfirming] = useState(false);

  const rows = useMemo(
    () => (mapping ? validateRows(body, mapping, opportunities, applications) : []),
    [body, mapping, opportunities, applications],
  );
  const missingRequired = mapping ? REQUIRED_FIELDS.filter((f) => mapping[f] < 0) : [];
  const actions = rows.map((r) => actionFor(r, policy));
  const count = (a: ImportAction) => actions.filter((x) => x === a).length;
  const applicable = count("create") + count("track") + count("update");

  if (!ready) return <Loading />;

  const reset = () => {
    setHeaders([]);
    setBody([]);
    setMapping(null);
    setFileName("");
    setConfirming(false);
  };

  const onFile = async (f: File | undefined) => {
    setError("");
    setDone("");
    reset();
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) return setError("Please choose a .csv file.");
    if (f.size > MAX_BYTES) return setError("File is larger than 1 MB.");
    try {
      const parsed = parseCsv(await f.text());
      if (parsed.length < 2)
        return setError("The file needs a header row and at least one data row.");
      const [h, ...rest] = parsed;
      setHeaders(h!.map((x) => x.trim()));
      setBody(rest);
      setMapping(autoMap(h!));
      setFileName(f.name);
    } catch (e) {
      setError(
        e instanceof CsvError ? `Could not read CSV: ${e.message}` : "Could not read this file.",
      );
    }
  };

  const apply = () => {
    const plan: ImportPlanItem[] = [];
    rows.forEach((r, i) => {
      const a = actions[i];
      const base = { status: r.status, notes: r.notes, deadline: r.deadline };
      if (a === "create") {
        plan.push({
          kind: "create",
          ...base,
          opp: {
            id: `user-${uid()}`,
            title: r.title,
            organization: r.organization,
            category: r.category,
            location: r.location || "Unknown",
            mode: "unknown",
            summary: "Imported from CSV.",
            deadline: r.deadline,
            tags: [],
            requirements: [],
            funding: {
              tuition: { status: "unknown" },
              living: { status: "unknown" },
              travel: { status: "unknown" },
              paymentTiming: null,
            },
            sourceUrl: r.link,
            applyUrl: r.link,
            lastVerified: null,
            verification: "user_entered",
            isDemo: false,
          },
        });
      } else if (a === "track" && r.existingOppId)
        plan.push({ kind: "track", oppId: r.existingOppId, ...base });
      else if (a === "update" && r.existingAppId)
        plan.push({ kind: "update", appId: r.existingAppId, ...base });
    });
    importTracker(plan);
    setDone(
      `Imported ${plan.length} row${plan.length === 1 ? "" : "s"}. ${rows.length - plan.length} skipped.`,
    );
    reset();
  };

  return (
    <>
      <PageHeader
        title="Import & export"
        sub="Move your tracker in and out as a CSV spreadsheet. Nothing changes until you confirm."
      />
      {done && (
        <p role="status" className="mb-4 rounded-lg bg-teal-soft p-3 text-sm">
          {done}{" "}
          <Link to="/journey" className="underline">
            Open My Journey
          </Link>
        </p>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-xl">Export</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {applications.length} tracked item{applications.length === 1 ? "" : "s"}. Cells starting
            with = + - @ are prefixed with ' so spreadsheets don't run them.
          </p>
          <button
            className="btn mt-3"
            disabled={applications.length === 0}
            onClick={() =>
              download("opportunityos-tracker.csv", exportCsv(applications, opportunities))
            }
          >
            Download CSV
          </button>
        </section>
        <section className="card p-5">
          <h2 className="text-xl">Template</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Columns: {TRACKER_FIELDS.join(", ")}. Title and organization are required. Dates use
            YYYY-MM-DD.
          </p>
          <button
            className="btn btn-outline mt-3"
            onClick={() => download("opportunityos-template.csv", templateCsv())}
          >
            Download template
          </button>
        </section>
      </div>

      <section className="card p-5" aria-labelledby="imp">
        <h2 id="imp" className="text-xl">
          Import
        </h2>
        <label htmlFor="csv" className="mt-3 block">
          CSV file (max 1 MB, {MAX_ROWS} rows)
        </label>
        <input
          id="csv"
          type="file"
          accept=".csv,text/csv"
          className="mt-1"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {error && (
          <p role="alert" className="field-error mt-2">
            {error}
          </p>
        )}

        {mapping && (
          <>
            <p className="mt-4 text-sm">
              File: <strong>{fileName}</strong> · {body.length} data row
              {body.length === 1 ? "" : "s"}
              {body.length > MAX_ROWS ? ` (only first ${MAX_ROWS} used)` : ""}
            </p>
            <h3 className="mt-4 text-lg">1. Match columns</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TRACKER_FIELDS.map((f) => (
                <div key={f}>
                  <label htmlFor={`map-${f}`} className="capitalize">
                    {f}
                    {REQUIRED_FIELDS.includes(f) ? " *" : ""}
                  </label>
                  <select
                    id={`map-${f}`}
                    value={mapping[f]}
                    onChange={(e) => setMapping({ ...mapping, [f]: Number(e.target.value) })}
                  >
                    <option value={-1}>— not imported —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {missingRequired.length > 0 && (
              <p role="alert" className="field-error mt-2">
                Match a column for: {missingRequired.join(", ")}
              </p>
            )}

            <h3 className="mt-6 text-lg">2. If an item is already in My Journey</h3>
            <div
              className="mt-2 flex flex-wrap gap-4"
              role="radiogroup"
              aria-label="Duplicate handling"
            >
              <label className="flex items-center gap-2 font-normal">
                <input
                  type="radio"
                  className="w-auto"
                  name="dup"
                  checked={policy === "skip"}
                  onChange={() => setPolicy("skip")}
                />{" "}
                Skip it (keep my current data)
              </label>
              <label className="flex items-center gap-2 font-normal">
                <input
                  type="radio"
                  className="w-auto"
                  name="dup"
                  checked={policy === "update"}
                  onChange={() => setPolicy("update")}
                />{" "}
                Update status, notes and deadline
              </label>
            </div>

            <h3 className="mt-6 text-lg">3. Preview</h3>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {count("create")} new · {count("track")} track existing · {count("update")} update ·{" "}
              {count("skip")} skip · {count("invalid")} with errors
            </p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2">Line</th>
                    <th className="p-2">Action</th>
                    <th className="p-2">Title</th>
                    <th className="p-2">Organization</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Deadline</th>
                    <th className="p-2">Problems / notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.line} className="border-t border-border align-top">
                      <td className="p-2">{r.line}</td>
                      <td className="p-2">
                        <span className={`chip ${ACTION_LABEL[actions[i]!].cls}`}>
                          {ACTION_LABEL[actions[i]!].t}
                        </span>
                      </td>
                      <td className="p-2">{r.title || "—"}</td>
                      <td className="p-2">{r.organization || "—"}</td>
                      <td className="p-2">{r.status}</td>
                      <td className="p-2">{r.deadline ?? "—"}</td>
                      <td className="p-2">
                        {r.errors.map((e) => (
                          <div key={e} className="text-destructive">
                            {e}
                          </div>
                        ))}
                        {r.warnings.map((w) => (
                          <div key={w} className="text-muted-foreground">
                            {w}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!confirming ? (
                <button
                  className="btn"
                  disabled={applicable === 0 || missingRequired.length > 0}
                  onClick={() => setConfirming(true)}
                >
                  Review import of {applicable} row{applicable === 1 ? "" : "s"}
                </button>
              ) : (
                <div
                  role="alertdialog"
                  aria-labelledby="cf"
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-primary p-3"
                >
                  <span id="cf" className="text-sm">
                    Apply {applicable} change{applicable === 1 ? "" : "s"} to My Journey? Rows with
                    errors are left out.
                  </span>
                  <button className="btn btn-sm" autoFocus onClick={apply}>
                    Yes, import
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => setConfirming(false)}>
                    Back
                  </button>
                </div>
              )}
              <button className="btn btn-ghost" onClick={reset}>
                Cancel
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
