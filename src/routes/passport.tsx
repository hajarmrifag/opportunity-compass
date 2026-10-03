import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { z } from "zod";
import { useStore } from "@/lib/store";
import { EMPTY_PROFILE } from "@/data/fixtures";
import { CATEGORY_LABELS, DEGREE_LABELS, type Category, type DegreeLevel, type Profile } from "@/domain/types";
import { Loading, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/passport")({
  head: () => ({
    meta: [
      { title: "Opportunity Passport — OpportunityOS" },
      { name: "description", content: "Review and confirm your student profile." },
      { property: "og:title", content: "Opportunity Passport — OpportunityOS" },
      { property: "og:description", content: "Review and confirm your student profile." },
    ],
  }),
  component: Passport,
});

const schema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(100),
  degreeLevel: z.string({ message: "Choose a degree level" }).min(1, "Choose a degree level"),
  field: z.string().trim().min(1, "Field of study is required").max(100),
  graduationYear: z.number({ message: "Enter a year" }).int().min(1990, "Year looks too early").max(2040, "Year looks too late"),
  goals: z.string().max(1000),
});

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 30);

function Passport() {
  const { ready, profile, saveProfile, loadDemoProfile, profileDraft, setProfileDraft } = useStore();
  const [p, setP] = useState<Profile>(EMPTY_PROFILE);
  const [skills, setSkills] = useState("");
  const [langs, setLangs] = useState("");
  const [locs, setLocs] = useState("");
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // Restore unsaved edits if the user navigated away; otherwise show the saved Passport.
    const src = profileDraft ?? profile ?? EMPTY_PROFILE;
    setP(src);
    setSkills(src.skills.join(", "));
    setLangs(src.languages.join(", "));
    setLocs(src.preferences.locations.join(", "));
  }, [profile]);

  const build = (): Profile => ({ ...p, skills: list(skills), languages: list(langs), preferences: { ...p.preferences, locations: list(locs) } });
  const dirty = !!profile && JSON.stringify(build()) !== JSON.stringify(profile);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { if (ready) setHydrated(true); }, [ready]);
  const draftJson = dirty ? JSON.stringify(build()) : "";
  useEffect(() => {
    if (!hydrated) return;
    setProfileDraft(draftJson ? (JSON.parse(draftJson) as Profile) : null);
  }, [draftJson, hydrated, setProfileDraft]);

  if (!ready) return <Loading />;

  const submit = (confirm: boolean) => {
    const next = build();
    if (confirm) {
      const r = schema.safeParse({ ...next, degreeLevel: next.degreeLevel ?? "", graduationYear: next.graduationYear ?? undefined });
      if (!r.success) {
        const e: Partial<Record<string, string>> = {};
        r.error.issues.forEach((i) => { e[String(i.path[0])] = i.message; });
        setErrors(e);
        setMsg("Please fix the highlighted fields before confirming.");
        return;
      }
    }
    setErrors({});
    saveProfile({ ...next, confirmed: confirm, confirmedAt: confirm ? new Date().toISOString() : null });
    setMsg(confirm ? "Passport confirmed. Eligibility checks now use it." : "Draft saved (not confirmed).");
  };

  const toggleCat = (c: Category) =>
    setP((x) => ({ ...x, preferences: { ...x.preferences, categories: x.preferences.categories.includes(c) ? x.preferences.categories.filter((y) => y !== c) : [...x.preferences.categories, c] } }));

  return (
    <>
      <PageHeader
        title="Opportunity Passport"
        sub="Enter details manually. You must review and confirm before eligibility checks run."
        right={<button className="btn btn-outline" onClick={() => { loadDemoProfile(); setMsg("Loaded fictional demo profile (Maya). Review, then confirm."); }}>Load demo profile</button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {profile?.confirmed
          ? <span className="chip chip-met">✓ Confirmed {profile.confirmedAt ? new Date(profile.confirmedAt).toLocaleDateString() : ""}</span>
          : <span className="chip chip-unknown">Not confirmed</span>}
        {dirty && (
          <span className="chip chip-unknown" role="status">
            Unsaved edits — eligibility still uses your {profile?.confirmed ? "last confirmed" : "saved"} Passport until you {profile?.confirmed ? "confirm again" : "save and confirm"}
          </span>
        )}
        {p.source === "demo" && <span className="chip chip-demo">Demo profile</span>}
      </div>
      {msg && <p role="status" className="mb-4 rounded-lg bg-teal-soft p-3 text-sm">{msg}</p>}

      <form className="card grid gap-5 p-6 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(true); }} noValidate>
        <F id="fullName" label="Name" err={errors["fullName"]}>
          <input id="fullName" value={p.fullName} maxLength={100} onChange={(e) => setP({ ...p, fullName: e.target.value })} aria-invalid={!!errors["fullName"]} />
        </F>
        <F id="degree" label="Degree level" err={errors["degreeLevel"]}>
          <select id="degree" value={p.degreeLevel ?? ""} onChange={(e) => setP({ ...p, degreeLevel: (e.target.value || null) as DegreeLevel | null })} aria-invalid={!!errors["degreeLevel"]}>
            <option value="">Select…</option>
            {Object.entries(DEGREE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </F>
        <F id="field" label="Field of study" err={errors["field"]}>
          <input id="field" value={p.field} maxLength={100} placeholder="e.g. Computer Science" onChange={(e) => setP({ ...p, field: e.target.value })} aria-invalid={!!errors["field"]} />
        </F>
        <F id="grad" label="Graduation year" err={errors["graduationYear"]}>
          <input id="grad" type="number" inputMode="numeric" value={p.graduationYear ?? ""} onChange={(e) => setP({ ...p, graduationYear: e.target.value ? Number(e.target.value) : null })} aria-invalid={!!errors["graduationYear"]} />
        </F>
        <F id="skills" label="Skills (comma separated)">
          <input id="skills" value={skills} maxLength={500} placeholder="Python, SQL" onChange={(e) => setSkills(e.target.value)} />
        </F>
        <F id="langs" label="Languages (comma separated)">
          <input id="langs" value={langs} maxLength={300} placeholder="English, Spanish" onChange={(e) => setLangs(e.target.value)} />
        </F>
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-semibold">Preferred categories</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <button type="button" key={c} aria-pressed={p.preferences.categories.includes(c)} onClick={() => toggleCat(c)} className={`btn btn-sm ${p.preferences.categories.includes(c) ? "" : "btn-outline"}`}>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </fieldset>
        <F id="locs" label="Preferred locations (comma separated)">
          <input id="locs" value={locs} maxLength={300} onChange={(e) => setLocs(e.target.value)} />
        </F>
        <label className="flex items-center gap-2 self-end font-normal">
          <input type="checkbox" className="w-auto" checked={p.preferences.remoteOk} onChange={(e) => setP({ ...p, preferences: { ...p.preferences, remoteOk: e.target.checked } })} />
          Open to remote opportunities
        </label>
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-semibold">Funding needs</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {(["tuition", "living", "travel"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 font-normal capitalize">
                <input type="checkbox" className="w-auto" checked={p.fundingNeeds[k]} onChange={(e) => setP({ ...p, fundingNeeds: { ...p.fundingNeeds, [k]: e.target.checked } })} />
                {k === "living" ? "Living costs" : k}
              </label>
            ))}
          </div>
        </fieldset>
        <F id="goals" label="Goals" className="md:col-span-2">
          <textarea id="goals" rows={3} maxLength={1000} value={p.goals} onChange={(e) => setP({ ...p, goals: e.target.value })} />
        </F>
        <div className="flex flex-wrap gap-3 md:col-span-2">
          <button type="submit" className="btn">I've reviewed this — Confirm Passport</button>
          <button type="button" className="btn btn-outline" onClick={() => submit(false)}>Save draft</button>
        </div>
        <p className="text-xs text-muted-foreground md:col-span-2">CV import is not available yet. Editing a confirmed Passport and saving a draft un-confirms it.</p>
      </form>
    </>
  );
}

function F({ id, label, err, children, className = "" }: { id: string; label: string; err?: string | undefined; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      <div className="mt-1">{children}</div>
      {err && <p className="field-error">{err}</p>}
    </div>
  );
}
