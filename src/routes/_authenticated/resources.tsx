import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteResource, isAdmin, listResources, saveResource } from "@/lib/tracker.functions";
import { Loading, PageHeader } from "@/components/ui-bits";
import { safeHttpUrl } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/resources")({
  head: () => ({
    meta: [
      { title: "Resources — Source" },
      { name: "description", content: "A shared, curated library of career resources." },
      { property: "og:title", content: "Resources — Source" },
      { property: "og:description", content: "A shared, curated library of career resources." },
    ],
  }),
  component: ResourcesPage,
});

function ResourcesPage() {
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ["resources"], queryFn: () => listResources() });
  const admin = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdmin() });

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tag, setTag] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["resources"] });
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError("");
    try {
      await saveResource({
        data: {
          title: title.trim(),
          url: url.trim() || null,
          tag: tag.trim(),
          notes: notes.trim(),
        },
      });
      setTitle("");
      setUrl("");
      setTag("");
      setNotes("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  if (mine.isLoading) return <Loading />;

  return (
    <>
      <PageHeader
        title="Resources"
        sub="A shared, curated list. Only admins can add, edit or remove items. Links open in a new tab."
      />
      {admin.data === true && (
        <form onSubmit={add} className="card mb-6 grid gap-3 p-5 sm:grid-cols-2">
          <div>
            <label htmlFor="res-title">Title *</label>
            <input
              id="res-title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="res-url">Link (optional)</label>
            <input
              id="res-url"
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="res-tag">Tag (optional)</label>
            <input
              id="res-tag"
              value={tag}
              maxLength={60}
              onChange={(e) => setTag(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="res-notes">Notes (optional)</label>
            <input
              id="res-notes"
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            {error && (
              <p role="alert" className="field-error mb-2">
                {error}
              </p>
            )}
            <button className="btn" type="submit" disabled={busy || !title.trim()}>
              Add resource
            </button>
          </div>
        </form>
      )}

      {(mine.data ?? []).length === 0 ? (
        <p className="text-muted-foreground">No resources have been added yet.</p>
      ) : (
        <ul className="space-y-3">
          {(mine.data ?? []).map((r) => {
            const href = r.url ? safeHttpUrl(r.url) : null;
            return (
              <li key={r.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {r.title}
                      </a>
                    ) : (
                      r.title
                    )}
                  </p>
                  {r.tag && <p className="text-xs text-muted-foreground">Tag: {r.tag}</p>}
                  {r.notes && <p className="mt-1 text-sm">{r.notes}</p>}
                </div>
                {admin.data === true && (
                  <button
                    className="text-xs underline hover:text-destructive"
                    onClick={() => {
                      if (confirm("Delete this resource?"))
                        deleteResource({ data: { id: r.id } }).then(refresh, () =>
                          setError("Could not delete."),
                        );
                    }}
                  >
                    Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
