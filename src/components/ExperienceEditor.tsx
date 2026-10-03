import { useState } from "react";
import { Check, FlaskConical, HandHeart, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WORK_TYPE_LABELS,
  type Profile,
  type WorkExperienceEntry,
  type WorkType,
} from "@/domain/types";
import { acceptExperience, dismissExperience } from "@/lib/profileExtraction";

const blank = (type: WorkType | null): WorkExperienceEntry => ({
  id: `exp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  role: "",
  organization: "",
  type,
  location: "",
  description: "",
  sourceFile: "",
  snippet: "",
  outputs: [],
  progress: "",
});

const GROUPS: { key: string; title: string; icon: typeof FlaskConical; match: (e: WorkExperienceEntry) => boolean }[] = [
  { key: "research", title: "Research", icon: FlaskConical, match: (e) => e.type === "research" },
  { key: "volunteer", title: "Volunteer", icon: HandHeart, match: (e) => e.type === "volunteer" },
  {
    key: "work",
    title: "Work and other roles",
    icon: Pencil,
    match: (e) => e.type !== "research" && e.type !== "volunteer",
  },
];

export function ExperienceEditor({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (next: Profile) => void;
}) {
  const [editing, setEditing] = useState<WorkExperienceEntry | null>(null);
  const suggestions = profile.experienceSuggestions ?? [];
  const roles = profile.workExperience ?? [];

  const save = () => {
    if (!editing) return;
    if (!editing.role.trim() && !editing.organization.trim()) return;
    const exists = roles.some((r) => r.id === editing.id);
    onChange({
      ...profile,
      workExperience: exists
        ? roles.map((r) => (r.id === editing.id ? editing : r))
        : [...roles, editing],
    });
    setEditing(null);
  };

  return (
    <section className="md:col-span-2 border-t border-border pt-5" aria-labelledby="experience-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="experience-title" className="text-xl">
            Research, volunteer and work experience
          </h3>
          <p className="text-sm text-muted-foreground">
            Found roles appear as suggestions. Only roles you accept or type are used in your
            profile.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(blank("research"))}>
            <Plus /> Research
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(blank("volunteer"))}>
            <Plus /> Volunteer
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(blank(null))}>
            <Plus /> Other role
          </Button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4 border-l-2 border-accent bg-teal-soft p-4" aria-live="polite">
          <p className="font-semibold">
            {suggestions.length} suggested {suggestions.length === 1 ? "role" : "roles"} from your
            sources
          </p>
          <ul className="mt-3 grid gap-3">
            {suggestions.map((item) => (
              <li key={item.id} className="border border-border bg-card p-3">
                <EntryBody item={item} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => onChange(acceptExperience(profile, item.id))}>
                    <Check /> Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onChange(acceptExperience(profile, item.id));
                      setEditing(item);
                    }}
                  >
                    <Pencil /> Accept and edit
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => onChange(dismissExperience(profile, item.id))}>
                    <X /> Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <div className="mt-4 grid gap-3 border border-border bg-card p-4 md:grid-cols-2">
          <Field label="Role" id="exp-role">
            <input id="exp-role" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} />
          </Field>
          <Field label="Organisation" id="exp-org">
            <input id="exp-org" value={editing.organization} onChange={(e) => setEditing({ ...editing, organization: e.target.value })} />
          </Field>
          <Field label="Type" id="exp-type">
            <select
              id="exp-type"
              value={editing.type ?? ""}
              onChange={(e) => setEditing({ ...editing, type: (e.target.value || null) as WorkType | null })}
            >
              <option value="">Not stated</option>
              {(Object.keys(WORK_TYPE_LABELS) as WorkType[]).map((t) => (
                <option key={t} value={t}>
                  {WORK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location" id="exp-loc">
            <input id="exp-loc" value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} />
          </Field>
          <Field label="What you did" id="exp-desc" wide>
            <textarea id="exp-desc" rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </Field>
          <Field label="Your progress so far" id="exp-progress" wide>
            <textarea
              id="exp-progress"
              rows={2}
              placeholder="e.g. Finished data collection, now writing results"
              value={editing.progress}
              onChange={(e) => setEditing({ ...editing, progress: e.target.value })}
            />
          </Field>
          <Field label="Outputs (one per line: papers, posters, projects, impact)" id="exp-outputs" wide>
            <textarea
              id="exp-outputs"
              rows={3}
              value={editing.outputs.join("\n")}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  outputs: e.target.value.split("\n").map((s) => s.trimStart()).slice(0, 20),
                })
              }
            />
          </Field>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button
              type="button"
              onClick={() => {
                setEditing({ ...editing, outputs: editing.outputs.map((s) => s.trim()).filter(Boolean) });
                save();
              }}
              disabled={!editing.role.trim() && !editing.organization.trim()}
            >
              Save role
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {roles.length === 0 && !editing ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No experience added yet. Extract a CV or link, or add a role yourself.
        </p>
      ) : (
        GROUPS.map(({ key, title, icon: Icon, match }) => {
          const items = roles.filter(match);
          if (!items.length) return null;
          return (
            <div key={key} className="mt-5">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="size-4 text-accent" /> {title} · {items.length}
              </h4>
              <ul className="mt-2 grid gap-3">
                {items.map((item) => (
                  <li key={item.id} className="border border-border p-3">
                    <EntryBody item={item} />
                    <div className="mt-2 flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(item)} aria-label={`Edit ${item.role || item.organization}`}>
                        <Pencil /> Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${item.role || item.organization}`}
                        onClick={() => onChange({ ...profile, workExperience: roles.filter((r) => r.id !== item.id) })}
                      >
                        <Trash2 /> Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}

function EntryBody({ item }: { item: WorkExperienceEntry }) {
  return (
    <div>
      <p className="font-semibold">
        {item.role || "Role not stated"}
        <span className="font-normal text-muted-foreground"> · {item.organization || "Organisation not stated"}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {item.type ? WORK_TYPE_LABELS[item.type] : "Type not stated"}
        {item.location ? ` · ${item.location}` : ""}
      </p>
      {item.description && <p className="mt-1 text-sm">{item.description}</p>}
      {item.progress && (
        <p className="mt-1 text-sm">
          <span className="font-semibold">Progress:</span> {item.progress}
        </p>
      )}
      {item.outputs.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-sm">
          {item.outputs.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      )}
      {item.sourceFile && (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-semibold text-primary">From {item.sourceFile}</span>
          {item.snippet ? ` · “${item.snippet}”` : ""}
        </p>
      )}
    </div>
  );
}

function Field({ label, id, wide, children }: { label: string; id: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label htmlFor={id}>{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
