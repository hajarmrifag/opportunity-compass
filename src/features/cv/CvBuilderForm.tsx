// @ts-nocheck -- verbatim teammate source; strict optional-type checks disabled here
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BuilderAnswers, BuilderEntry } from "./types";
import {
  LANGUAGE_LEVELS,
  LIMITS,
  addItem,
  checkCity,
  checkEmail,
  checkLink,
  checkName,
  checkPhone,
  checkPoint,
  checkYear,
  countDigits,
  formatAward,
  formatLanguage,
  hasError,
  sanitizePhone,
  type FieldIssue,
  type LanguageLevel,
} from "./validate";

const field =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const area = "w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const emptyEntry = (): BuilderEntry => ({ title: "", organisation: "", location: "", dates: "", link: "", description: "" });

type ListKey = "education" | "experience" | "activities" | "projects";

const STEPS: Array<{ key: ListKey | "about" | "skills"; title: string; help: string }> = [
  { key: "about", title: "About you", help: "How employers will contact you." },
  { key: "education", title: "Education", help: "Your university, degree and dates. Add your grade only if you want it on your CV." },
  { key: "experience", title: "Work experience", help: "Jobs, internships, tutoring, part-time work. One point per line, in your own words." },
  { key: "activities", title: "Leadership and activities", help: "Societies, volunteering, competitions, sports." },
  { key: "projects", title: "Projects", help: "Course or personal projects you are proud of. Skip if none." },
  { key: "skills", title: "Skills, languages and awards", help: "Add each one separately. They appear as short labelled lines on your CV." },
];

const LIST_LABELS: Record<ListKey, { title: string; org: string }> = {
  education: { title: "Degree and major", org: "University or school" },
  experience: { title: "Role", org: "Organisation" },
  activities: { title: "Role", org: "Society or organisation" },
  projects: { title: "Project name", org: "Course or context (optional)" },
};

function Issues({ issues }: { issues: FieldIssue[] }) {
  if (!issues.length) return null;
  return (
    <>
      {issues.map((i) => (
        <span key={i.message} className={`block text-xs ${i.level === "error" ? "text-destructive" : "text-muted-foreground"}`} role={i.level === "error" ? "alert" : undefined}>
          {i.message}
        </span>
      ))}
    </>
  );
}

/** Small tags with a remove button. */
function Tags({ items, onRemove }: { items: string[]; onRemove: (i: number) => void }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((t, i) => (
        <li key={t} className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
          {t}
          <button className="text-muted-foreground" aria-label={`Remove ${t}`} onClick={() => onRemove(i)}>
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Step-by-step questions for students without a CV. Everything is in the student's own words;
 * the AI only tailors it afterwards, in the conversation, under the facts-only rules.
 * Contact details are checked (email format and length, phone digits) before moving on.
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
    skillsList: [],
    languagesList: [],
    awardsList: [],
    ...prefill,
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [skillDraft, setSkillDraft] = useState("");
  const [langDraft, setLangDraft] = useState("");
  const [langLevel, setLangLevel] = useState<LanguageLevel | "">("Fluent");
  const [awardDraft, setAwardDraft] = useState("");
  const [awardYear, setAwardYear] = useState("");
  const [listIssue, setListIssue] = useState<Record<string, string | null>>({});

  const current = STEPS[step];
  const set = (patch: Partial<BuilderAnswers>) => setA({ ...a, ...patch });
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));
  /** Updates a contact field and shows its check immediately (not only after leaving the box). */
  const setLive = (k: "name" | "email" | "phone" | "city" | "links", value: string) => {
    set({ [k]: value } as Partial<BuilderAnswers>);
    if (value.trim()) touch(k);
  };
  const show = (k: string, issues: FieldIssue[]) => (touched[k] ? issues : []);

  const updateEntry = (key: ListKey, i: number, patch: Partial<BuilderEntry>) =>
    set({ [key]: a[key].map((e, j) => (j === i ? { ...e, ...patch } : e)) } as Partial<BuilderAnswers>);

  // Checks for the current step
  const aboutIssues = {
    name: checkName(a.name),
    email: checkEmail(a.email ?? ""),
    phone: checkPhone(a.phone ?? ""),
    city: checkCity(a.city ?? ""),
    links: checkLink(a.links ?? ""),
  };
  const entryLinkIssues = (e: BuilderEntry) => checkLink(e.link ?? "");
  const stepHasError =
    current.key === "about"
      ? Object.values(aboutIssues).some(hasError)
      : current.key === "projects"
        ? a.projects.some((e) => hasError(entryLinkIssues(e)))
        : false;

  const next = () => {
    if (current.key === "about") setTouched({ ...touched, name: true, email: true, phone: true, city: true, links: true });
    if (stepHasError) return;
    setStep(step + 1);
  };

  const add = (key: "skillsList" | "languagesList" | "awardsList", value: string, max: number, clear: () => void) => {
    const { list, issue } = addItem(a[key] ?? [], value, max);
    setListIssue({ ...listIssue, [key]: issue });
    if (!issue && list !== a[key]) {
      set({ [key]: list } as Partial<BuilderAnswers>);
      clear();
    }
  };
  const remove = (key: "skillsList" | "languagesList" | "awardsList", i: number) =>
    set({ [key]: (a[key] ?? []).filter((_, j) => j !== i) } as Partial<BuilderAnswers>);

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
            <input className={field} maxLength={LIMITS.name} value={a.name} onChange={(e) => setLive("name", e.target.value)} onBlur={() => touch("name")} />
            <Issues issues={show("name", aboutIssues.name)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Email</span>
            <input
              className={field}
              type="email"
              inputMode="email"
              maxLength={LIMITS.email}
              placeholder="name@example.com"
              value={a.email ?? ""}
              onChange={(e) => setLive("email", e.target.value.replace(/\s/g, ""))}
              onBlur={() => touch("email")}
            />
            <Issues issues={show("email", aboutIssues.email)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Phone (optional)</span>
            <input
              className={field}
              type="tel"
              inputMode="tel"
              maxLength={LIMITS.phone}
              placeholder="+852 5123 4567"
              value={a.phone ?? ""}
              onChange={(e) => setLive("phone", sanitizePhone(e.target.value))}
              onBlur={() => setTouched((t) => ({ ...t, phone: true, phoneLeft: true }))}
            />
            {(a.phone ?? "").trim() && (
              <span className="block text-xs text-muted-foreground">
                {countDigits(a.phone ?? "")} of {LIMITS.phoneDigitsMax} digits maximum
              </span>
            )}
            <Issues issues={show("phone", aboutIssues.phone).filter((i) => !(i.message.startsWith("Too few") && !touched.phoneLeft))} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">City</span>
            <input className={field} maxLength={LIMITS.city} value={a.city ?? ""} onChange={(e) => setLive("city", e.target.value)} onBlur={() => touch("city")} />
            <Issues issues={show("city", aboutIssues.city)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">LinkedIn or website (optional)</span>
            <input
              className={field}
              maxLength={LIMITS.link}
              placeholder="linkedin.com/in/your-name"
              value={a.links ?? ""}
              onChange={(e) => setLive("links", e.target.value.trim())}
              onBlur={() => touch("links")}
            />
            <Issues issues={show("links", aboutIssues.links)} />
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
                  <input className={field} maxLength={LIMITS.title} value={entry.title} onChange={(e) => updateEntry(key, i, { title: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">{LIST_LABELS[key].org}</span>
                  <input
                    className={field}
                    maxLength={LIMITS.organisation}
                    value={entry.organisation}
                    onChange={(e) => updateEntry(key, i, { organisation: e.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Dates</span>
                  <input
                    className={field}
                    maxLength={LIMITS.dates}
                    placeholder="e.g. Sep 2025 – present"
                    value={entry.dates ?? ""}
                    onChange={(e) => updateEntry(key, i, { dates: e.target.value })}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Location (optional)</span>
                  <input className={field} maxLength={LIMITS.city} value={entry.location ?? ""} onChange={(e) => updateEntry(key, i, { location: e.target.value })} />
                </label>
                {key === "projects" && (
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-xs text-muted-foreground">Link to the project (optional)</span>
                    <input
                      className={field}
                      maxLength={LIMITS.link}
                      placeholder="e.g. github.com/you/project, a portfolio page or a post about it"
                      value={entry.link ?? ""}
                      onChange={(e) => updateEntry(key, i, { link: e.target.value })}
                    />
                    <Issues issues={entryLinkIssues(entry)} />
                  </label>
                )}
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">What you did or achieved, one point per line</span>
                  <textarea className={`${area} min-h-24`} value={entry.description} onChange={(e) => updateEntry(key, i, { description: e.target.value })} />
                  <Issues issues={checkPoint(entry.description)} />
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
        <div className="space-y-5">
          {/* Skills */}
          <div className="space-y-2">
            <span className="block text-xs text-muted-foreground">Technical skills (e.g. Excel, Python, financial modelling)</span>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                add("skillsList", skillDraft, LIMITS.skills, () => setSkillDraft(""));
              }}
            >
              <input className={field} maxLength={LIMITS.item} value={skillDraft} onChange={(e) => setSkillDraft(e.target.value)} aria-label="Skill" />
              <Button type="submit" size="sm" disabled={!skillDraft.trim()}>
                Add
              </Button>
            </form>
            {listIssue.skillsList && <span className="block text-xs text-destructive">{listIssue.skillsList}</span>}
            <Tags items={a.skillsList ?? []} onRemove={(i) => remove("skillsList", i)} />
          </div>

          {/* Languages */}
          <div className="space-y-2">
            <span className="block text-xs text-muted-foreground">Languages and level</span>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                add("languagesList", formatLanguage(langDraft, langLevel), LIMITS.languages, () => setLangDraft(""));
              }}
            >
              <input className={`${field} min-w-40 flex-1`} maxLength={30} placeholder="e.g. English" value={langDraft} onChange={(e) => setLangDraft(e.target.value)} aria-label="Language" />
              <select className={`${field} w-40`} value={langLevel} onChange={(e) => setLangLevel(e.target.value as LanguageLevel | "")} aria-label="Level">
                {LANGUAGE_LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
                <option value="">No level</option>
              </select>
              <Button type="submit" size="sm" disabled={!langDraft.trim()}>
                Add
              </Button>
            </form>
            {listIssue.languagesList && <span className="block text-xs text-destructive">{listIssue.languagesList}</span>}
            <Tags items={a.languagesList ?? []} onRemove={(i) => remove("languagesList", i)} />
          </div>

          {/* Awards */}
          <div className="space-y-2">
            <span className="block text-xs text-muted-foreground">Awards and scholarships (optional)</span>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (hasError(checkYear(awardYear))) return;
                add("awardsList", formatAward(awardDraft, awardYear), LIMITS.awards, () => {
                  setAwardDraft("");
                  setAwardYear("");
                });
              }}
            >
              <input className={`${field} min-w-40 flex-1`} maxLength={LIMITS.item} placeholder="e.g. Entrance Scholarship" value={awardDraft} onChange={(e) => setAwardDraft(e.target.value)} aria-label="Award" />
              <input className={`${field} w-24`} inputMode="numeric" maxLength={4} placeholder="Year" value={awardYear} onChange={(e) => setAwardYear(e.target.value.replace(/\D/g, ""))} aria-label="Year" />
              <Button type="submit" size="sm" disabled={!awardDraft.trim() || hasError(checkYear(awardYear))}>
                Add
              </Button>
            </form>
            <Issues issues={checkYear(awardYear)} />
            {listIssue.awardsList && <span className="block text-xs text-destructive">{listIssue.awardsList}</span>}
            <Tags items={a.awardsList ?? []} onRemove={(i) => remove("awardsList", i)} />
          </div>
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
          <Button onClick={next} disabled={stepHasError}>
            Next
          </Button>
        ) : (
          <Button onClick={() => onDone(a)}>Create my CV</Button>
        )}
      </div>
      {stepHasError && current.key === "about" && (
        <p className="text-xs text-muted-foreground">
          {hasError(aboutIssues.name) && !a.name.trim() ? "Add your name to continue." : "Fix the details marked in red to continue."}
        </p>
      )}
    </section>
  );
}
