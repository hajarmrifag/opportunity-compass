import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { useStore } from "@/lib/store";
import { CATEGORY_LABELS, type Category, type Opportunity } from "@/domain/types";
import { PageHeader } from "@/components/ui-bits";
import { isValidIsoDate, oppKey } from "@/lib/validation";

export const Route = createFileRoute("/add")({
  head: () => ({
    meta: [
      { title: "Add opportunity — OpportunityOS" },
      { name: "description", content: "Track an opportunity you found elsewhere." },
      { property: "og:title", content: "Add opportunity — OpportunityOS" },
      { property: "og:description", content: "Track an opportunity you found elsewhere." },
    ],
  }),
  component: AddPage,
});

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  organization: z.string().trim().min(1, "Organization is required").max(150),
  category: z.enum(Object.keys(CATEGORY_LABELS) as [Category, ...Category[]]),
  location: z.string().trim().max(100),
  deadline: z.string().refine((d) => d === "" || isValidIsoDate(d), "Enter a real date"),
  link: z.string().trim().url("Enter a full URL starting with https://").refine((u) => /^https?:\/\//.test(u), "Must start with http(s)://").or(z.literal("")),
  summary: z.string().trim().max(1000),
});

function AddPage() {
  const { addManualOpportunity, saveOpportunity, opportunities } = useStore();
  const nav = useNavigate();
  const [v, setV] = useState({ title: "", organization: "", category: "internship" as Category, location: "", deadline: "", link: "", summary: "" });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(v);
    if (!r.success) {
      const errs: Partial<Record<string, string>> = {};
      r.error.issues.forEach((i) => { errs[String(i.path[0])] = i.message; });
      setErrors(errs);
      return;
    }
    const d = r.data;
    const dup = opportunities.find((o) => oppKey(o.title, o.organization) === oppKey(d.title, d.organization));
    if (dup) {
      saveOpportunity(dup.id); // idempotent: track the existing one instead of creating a copy
      nav({ to: "/journey" });
      return;
    }
    const opp: Opportunity = {
      id: `user-${Date.now().toString(36)}`,
      title: d.title, organization: d.organization, category: d.category,
      location: d.location || "Unknown", mode: "unknown", summary: d.summary || "Added manually.",
      deadline: d.deadline || null, tags: [], requirements: [],
      funding: { tuition: { status: "unknown" }, living: { status: "unknown" }, travel: { status: "unknown" }, paymentTiming: null },
      sourceUrl: d.link || null, applyUrl: d.link || null, lastVerified: null,
      verification: "user_entered", isDemo: false,
    };
    addManualOpportunity(opp);
    saveOpportunity(opp.id);
    nav({ to: "/journey" });
  };

  const err = (k: string) => errors[k] && <p className="field-error">{errors[k]}</p>;

  return (
    <>
      <PageHeader title="Add an opportunity" sub="For opportunities you found elsewhere. Saved to this browser and tracked as Saved." />
      <form onSubmit={submit} noValidate className="card grid max-w-3xl gap-4 p-6 md:grid-cols-2">
        <div><label htmlFor="t">Title *</label><input id="t" value={v.title} onChange={set("title")} aria-invalid={!!errors["title"]} />{err("title")}</div>
        <div><label htmlFor="o">Organization *</label><input id="o" value={v.organization} onChange={set("organization")} aria-invalid={!!errors["organization"]} />{err("organization")}</div>
        <div><label htmlFor="c">Category</label>
          <select id="c" value={v.category} onChange={set("category")}>
            {Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
        <div><label htmlFor="l">Location</label><input id="l" value={v.location} onChange={set("location")} /></div>
        <div><label htmlFor="d">Deadline</label><input id="d" type="date" value={v.deadline} onChange={set("deadline")} />{err("deadline")}</div>
        <div><label htmlFor="u">Link (optional)</label><input id="u" type="url" placeholder="https://" value={v.link} onChange={set("link")} aria-invalid={!!errors["link"]} />{err("link")}</div>
        <div className="md:col-span-2"><label htmlFor="s">Notes / summary</label><textarea id="s" rows={3} value={v.summary} onChange={set("summary")} /></div>
        <p className="text-xs text-muted-foreground md:col-span-2">If the same title and organization already exist, the existing item is tracked instead of creating a duplicate. Eligibility and funding will show as Unknown until verified data is available.</p>
        <div className="md:col-span-2"><button type="submit" className="btn">Add & track</button></div>
      </form>
    </>
  );
}
