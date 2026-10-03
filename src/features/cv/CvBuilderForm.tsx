import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BuilderAnswers, BuilderEntry } from "./types";

const field = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const area = "w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const emptyEntry = (): BuilderEntry => ({ title: "", organisation: "", location: "", dates: "", description: "" });

type ListKey = "education" | "experience" | "activities" | "projects";

const STEPS: Array<{ key: ListKey | "about" | "skills"; title: string; help: string }> = [
  { key: "about", title: "About you", help: "How employers will contact you." },
  { key: "education", title: "Education", help: "Your university, degree and dates. Add your grade only if you want it on your CV." },
  { key: "experience", title: "Work experience", help: "Jobs, internships, tutoring, part-time work. One point per line, in your own words." },
  { key: "activities", title: "Leadership and activities", help: "Societies, volunteering, competitions, sports." },
  { key: "projects", title: "Projects", help: "Course or personal projects you are proud of. Skip if none." },
  { key: "skills", title: "Skills, languages and awards", help: "Separate items with commas." },
];

const LIST_LABELS: Record<ListKey, { title: string; org: string }> = {
  education: { title: "Degree and major", org: "University or school" },
  experience: { title: "Role", org: "Organisation" },
  activities: { title: "Role", org: "Society or organisation" },
  projects: { title: "Project name", org: "Course or context (optional)" },
};

/**
 * Step-by-step questions for students without a CV. Everything is in the student's own words;
 * the AI only tailors it afterwards, in the conversation, under the facts-only rules.
 */
export function CvBuilderForm({
  prefill,
  onDone,
  onCancel,
}: {
  prefill?: Partial<BuilderAnswers>;
  onDone: (answers: BuilderAnswers) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<BuilderAnswers>({
    name: "",
    education: [emptyEntry()],
    experience: [emptyEntry()],
    activities: [emptyEntry()],
    projects: [],
    ...prefill,
  });
  const current = STEPS[step];
  const set = (patch: Partial<BuilderAnswers>) => setA({ ...a, ...patch });

  const updateEntry = (key: ListKey, i: number, patch: Partial<BuilderEntry>) =>
    set({ [key]: a[key].map((e, j) => (j === i ? { ...e, ...patch } : e)) } as Partial<BuilderAnswers>);

  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label="Build your CV">
      <div>
        <p className="text-xs text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </p>
        <h4 className="font-semibold">{current.title}</h4>
        <p className="text-sm text-muted-foreground">{current.help}</p>
      </div>

      {current.key === "about" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Full name</span>
            <input className={field} value={a.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Email</span>
            <input className={field} type="email" value={a.email ?? ""} onChange={(e) => set({ email: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Phone</span>
            <input className={field} value={a.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">City</span>
            <input className={field} value={a.city ?? ""} onChange={(e) => set({ city: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">LinkedIn or website (optional)</span>
            <input className={field} value={a.links ?? ""} onChange={(e) => set({ links: e.target.value })} />
          </label>
        </div>
      )}

      {(current.key === "education" || current.key === "experience" || current.key === "activities" || current.key === "projects") && (
        <div className="space-y-4">
          {a[current.key].map((entry, i) => {
            const key = current.key as ListKey;
            return (
              <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">{LIST_LABELS[key].title}</span>
                  <input className={field} value={entry.title} onChange={(e) => updateEntry(key, i, { title: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">{LIST_LABELS[key].org}</span>
                  <input className={field} value={entry.organisation} onChange={(e) => updateEntry(key, i, { organisation: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Dates</span>
                  <input className={field} placeholder="e.g. Sep 2025 – present" value={entry.dates ?? ""} onChange={(e) => updateEntry(key, i, { dates: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Location (optional)</span>
                  <input className={field} value={entry.location ?? ""} onChange={(e) => updateEntry(key, i, { location: e.target.value })} />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">What you did or achieved, one point per line</span>
                  <textarea className={`${area} min-h-24`} value={entry.description} onChange={(e) => updateEntry(key, i, { description: e.target.value })} />
                </label>
                <button
                  className="justify-self-start text-xs text-muted-foreground underline"
                  onClick={() => set({ [key]: a[key].filter((_, j) => j !== i) } as Partial<BuilderAnswers>)}
                >
                  Remove
                </button>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={() => set({ [current.key]: [...a[current.key as ListKey], emptyEntry()] } as Partial<BuilderAnswers>)}>
            Add another
          </Button>
        </div>
      )}

      {current.key === "skills" && (
        <div className="space-y-3">
          {(["skills", "languages", "awards"] as const).map((k) => (
            <label key={k} className="block space-y-1">
              <span className="text-xs capitalize text-muted-foreground">{k}</span>
              <input className={field} value={a[k] ?? ""} onChange={(e) => set({ [k]: e.target.value } as Partial<BuilderAnswers>)} />
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {step > 0 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={step === 0 && !a.name.trim()}>
            Next
          </Button>
        ) : (
          <Button onClick={() => onDone(a)}>Create my CV</Button>
        )}
      </div>
    </section>
  );
}
