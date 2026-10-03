import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BriefcaseBusiness,
  GraduationCap,
  HandHeart,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import type { Category } from "@/domain/types";
import { demoEligibilityAdapter } from "@/adapters/demoEligibility";
import { Loading } from "@/components/ui-bits";
import { MagneticLine } from "@/components/motion/MagneticLine";
import { spring, staggerContainer } from "@/lib/motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sourced" },
      {
        name: "description",
        content: "Search student opportunities from real pages. Every fact has a source.",
      },
      { property: "og:title", content: "Sourced" },
      {
        property: "og:description",
        content: "Search student opportunities from real pages. Every fact has a source.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const GOALS = [
  {
    value: "internship",
    label: "Internship",
    description: "Build experience with a team and a defined role.",
    icon: BriefcaseBusiness,
  },
  {
    value: "job",
    label: "Job",
    description: "Explore roles across sectors and career stages.",
    icon: UsersRound,
  },
  {
    value: "masters",
    label: "Master’s",
    description: "Explore taught and research postgraduate programmes.",
    icon: GraduationCap,
  },
  {
    value: "fellowship",
    label: "Fellowship",
    description: "Find structured professional or academic programmes.",
    icon: Sparkles,
  },
  {
    value: "scholarship",
    label: "Scholarship",
    description: "Search for support toward study costs.",
    icon: HandHeart,
  },
] as const satisfies ReadonlyArray<{
  value: Category;
  label: string;
  description: string;
  icon: typeof BriefcaseBusiness;
}>;

function Dashboard() {
  const { ready, profile, opportunities } = useStore();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [q, setQ] = useState("");
  const [goal, setGoal] = useState<Category | null>(null);

  const standing = useMemo(() => {
    if (!profile?.confirmed) return null;
    let open = 0;
    for (const opp of opportunities) {
      if (demoEligibilityAdapter.evaluate(profile, opp).overall !== "not_eligible") open += 1;
    }
    return { open };
  }, [opportunities, profile]);

  if (!ready) return <Loading />;

  const submitSearch = () => {
    const query = [q.trim(), goal ? GOALS.find((item) => item.value === goal)?.label : ""]
      .filter(Boolean)
      .join(" ");
    if (query.length >= 2) navigate({ to: "/search", search: { q: query } });
  };

  return (
    <div className="atlas-campaign">
      <section className="band zone zone-ink atlas-hero-band">
        <div className="band-inner atlas-hero" aria-labelledby="dashboard-title">
          <p className="atlas-kicker">Sourced</p>
          <h1 id="dashboard-title" className="atlas-hero-title" aria-label="Every opportunity has a source.">
            <MagneticLine text="Every" delay={0.08} />
            <MagneticLine text="opportunity" delay={0.18} />
            <MagneticLine text="has a source." delay={0.28} italic />
          </h1>
          <motion.div
            className="atlas-hero-cta"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.arrive, delay: 0.4 }}
          >
            <Link to="/search" search={{ demo: true }} className="atlas-hero-go">
              Watch a research run
              <ArrowRight aria-hidden />
            </Link>
            <p className="atlas-hero-go-note">Sixty seconds. Every page. Every keep and cut.</p>
          </motion.div>
          <p className="atlas-hero-deck">
            Search the open web for funding, fellowships and roles. Every fact is traced to the page
            it came from. When a page doesn’t say, we show “unknown” instead of guessing.
          </p>
          <motion.form
            className="atlas-cover-search"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.arrive, delay: 0.55 }}
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <label htmlFor="dq" className="sr-only">What are you looking for?</label>
            <Search aria-hidden className="size-5 shrink-0" />
            <input id="dq" value={q} maxLength={200} onChange={(event) => setQ(event.target.value)} placeholder="Or describe the opportunity you want…" />
            <Button className="atlas-search-submit" type="submit" disabled={[q.trim(), goal].filter(Boolean).length === 0} aria-label="Search the public web" size="icon">
              <ArrowRight aria-hidden />
            </Button>
          </motion.form>
        </div>
      </section>
      <section className="band zone zone-bone" aria-labelledby="start-title">
        <div className="band-inner atlas-home-next">
          <div>
            <h2 id="start-title">What are you <em>looking for?</em></h2>
            <p>
              {standing
                ? `${standing.open} listings in the demo field don’t rule you out. Search the live web for real ones.`
                : "Pick a direction, or confirm your Passport first so we can be honest about eligibility."}
            </p>
            <div className="atlas-home-actions">
              <Link to="/search" search={{ demo: true }} className="btn">Watch a research run</Link>
              <Link to="/search" className="btn btn-outline">Search the web</Link>
              <Link to="/passport" className="btn btn-ghost">{profile ? "Review Passport" : "Create Passport"}</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
