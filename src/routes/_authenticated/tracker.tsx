import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listTrackerApplications,
  removeTrackerApplication,
  TRACKER_SOURCES,
  TRACKER_STATUSES,
  updateTrackerApplication,
  updateTrackerStatus,
  type TrackerApplication,
} from "@/lib/tracker.functions";
import { Loading, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/tracker")({
  head: () => ({
    meta: [
      { title: "Tracker — OpportunityOS" },
      {
        name: "description",
        content: "Your account-backed application tracker with status history.",
      },
      { property: "og:title", content: "Tracker — OpportunityOS" },
      {
        property: "og:description",
        content: "Your account-backed application tracker with status history.",
      },
    ],
  }),
  component: TrackerPage,
});

const STATUS_LABEL: Record<string, string> = {
  saved: "Saved",
  preparing: "Preparing",
  submitted: "Submitted",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const SOURCE_LABEL: Record<string, string> = {
  referral: "Referral",
  cold: "Cold",
  career_fair: "Career fair",
  other: "Other",
};

function TrackerPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["tracker-applications"],
    queryFn: () => listTrackerApplications(),
  });
  const [search, setSearch] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["tracker-applications"] });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((a) =>
      [a.company, a.role, a.notes].some((field) => field.toLowerCase().includes(q)),
    );
  }, [data, search]);

  if (isLoading) return <Loading />;

  return (
    <>
      <PageHeader
        title="Tracker"
        sub="Saved to your account — every status change is recorded. My Journey (browser-local) stays separate."
        right={
          <Link to="/resources" className="btn btn-ghost">
            Resources
          </Link>
        }
      />
      {error && (
        <p role="alert" className="field-error mb-4">
          Could not load your tracker: {error instanceof Error ? error.message : "Unknown error"}
        </p>
      )}
      <div className="mb-4 max-w-md">
        <label htmlFor="tracker-search">Search company, role or notes</label>
        <input
          id="tracker-search"
          type="search"
          value={search}
          placeholder="e.g. Google, internship, referral…"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {(data ?? []).length === 0 ? (
        <div className="card p-6 text-sm text-muted-foreground">
          <p>
            Nothing tracked yet. Save a listing from Live search or Demo listings and it appears
            here.
          </p>
          <Link to="/search" className="btn mt-3 inline-block">
            Go to Live search
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No items match “{search}”.</p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((a) => (
            <TrackerRow key={a.id} app={a} onChanged={refresh} />
          ))}
        </ul>
      )}
    </>
  );
}

function TrackerRow({ app, onChanged }: { app: TrackerApplication; onChanged: () => void }) {
  const [notes, setNotes] = useState(app.notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = notes !== app.notes;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{app.role}</p>
          <p className="text-sm text-muted-foreground">{app.company}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved {new Date(app.created_at).toLocaleDateString()}
            {app.applied_date ? ` · Applied ${app.applied_date}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`src-${app.id}`}>Source</label>
            <select
              id={`src-${app.id}`}
              value={app.source}
              disabled={busy}
              onChange={(e) =>
                run(() =>
                  updateTrackerApplication({
                    data: { id: app.id, source: e.target.value as never },
                  }),
                )
              }
            >
              {TRACKER_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`st-${app.id}`}>Status</label>
            <select
              id={`st-${app.id}`}
              value={app.status}
              disabled={busy}
              onChange={(e) =>
                run(() =>
                  updateTrackerStatus({ data: { id: app.id, status: e.target.value as never } }),
                )
              }
            >
              {TRACKER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`ad-${app.id}`}>Applied date</label>
            <input
              id={`ad-${app.id}`}
              type="date"
              value={app.applied_date ?? ""}
              disabled={busy}
              onChange={(e) =>
                run(() =>
                  updateTrackerApplication({
                    data: { id: app.id, applied_date: e.target.value || null },
                  }),
                )
              }
            />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <label htmlFor={`n-${app.id}`}>Notes</label>
        <textarea
          id={`n-${app.id}`}
          rows={2}
          maxLength={5000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="mt-1 flex items-center gap-2">
          <button
            className="btn btn-sm"
            disabled={!dirty || busy}
            onClick={() => run(() => updateTrackerApplication({ data: { id: app.id, notes } }))}
          >
            Save notes
          </button>
          {error && (
            <span role="alert" className="field-error">
              {error}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          className="text-xs underline hover:text-destructive"
          disabled={busy}
          onClick={() => {
            if (confirm("Remove this application from your tracker?"))
              run(() => removeTrackerApplication({ data: { id: app.id } }));
          }}
        >
          Remove
        </button>
      </div>
    </li>
  );
}
