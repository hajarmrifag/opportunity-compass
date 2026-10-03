// FICTIONAL demo data. Organizations and programs are invented. Do not treat as real.
import type { Opportunity, Profile } from "@/domain/types";
import type { ResearchReplayFixture, ReplaySourceSpec } from "@/lib/researchReplay";
import type { TrailEvidence } from "@/lib/researchTrail";

const demo = {
  sourceUrl: null,
  applyUrl: null,
  lastVerified: null,
  verification: "demo_unverified" as const,
  isDemo: true,
};

export const DEMO_OPPORTUNITIES: Opportunity[] = [
  {
    ...demo,
    id: "demo-harbor-data-internship",
    title: "Data Analytics Summer Internship",
    organization: "Harborlight Analytics (fictional)",
    category: "internship",
    location: "Lisbon, Portugal",
    mode: "hybrid",
    summary:
      "Ten-week internship supporting a fictional analytics team with dashboards and data cleaning.",
    deadline: "2026-10-20",
    tags: ["data", "python", "sql", "computer science", "statistics"],
    requirements: [
      {
        id: "r1",
        kind: "degreeLevel",
        label: "Enrolled in a Bachelor's or Master's",
        values: ["bachelor", "master"],
      },
      { id: "r2", kind: "skill", label: "Python", values: ["python"] },
      { id: "r3", kind: "language", label: "English", values: ["english"] },
      { id: "r4", kind: "other", label: "Right to work in Portugal" },
    ],
    funding: {
      tuition: { status: "not_covered" },
      living: {
        status: "partial",
        note: "Monthly stipend stated; amount vs. living costs unknown",
      },
      travel: { status: "unknown" },
      paymentTiming: "Monthly, in arrears",
    },
  },
  {
    ...demo,
    id: "demo-meridian-scholarship",
    title: "Meridian Global Master's Scholarship",
    organization: "Meridian Education Trust (fictional)",
    category: "scholarship",
    location: "Any partner university",
    mode: "in_person",
    summary:
      "Fictional scholarship for international students starting a master's in a STEM field.",
    deadline: "2026-11-30",
    tags: ["stem", "engineering", "computer science", "international"],
    requirements: [
      { id: "r1", kind: "degreeLevel", label: "Completing a Bachelor's", values: ["bachelor"] },
      {
        id: "r2",
        kind: "field",
        label: "STEM field",
        values: [
          "computer science",
          "engineering",
          "mathematics",
          "physics",
          "biology",
          "chemistry",
        ],
      },
      { id: "r3", kind: "graduationYear", label: "Graduating 2026–2027", min: 2026, max: 2027 },
      { id: "r4", kind: "other", label: "Admission offer from a partner university" },
    ],
    funding: {
      tuition: { status: "covered", note: "Full tuition at partner institutions" },
      living: { status: "unknown" },
      travel: { status: "unknown" },
      paymentTiming: null,
    },
  },
  {
    ...demo,
    id: "demo-coastal-research",
    title: "Undergraduate Coastal Ecology Research Placement",
    organization: "Tidewater Field Institute (fictional)",
    category: "research",
    location: "Remote + 2-week field visit",
    mode: "hybrid",
    summary:
      "Assist a fictional research group analysing coastal sensor data, with a short field component.",
    deadline: "2026-10-12",
    tags: ["biology", "environment", "research", "r", "data"],
    requirements: [
      { id: "r1", kind: "degreeLevel", label: "Bachelor's student", values: ["bachelor"] },
      {
        id: "r2",
        kind: "field",
        label: "Biology or environmental science",
        values: ["biology", "environmental science"],
      },
      { id: "r3", kind: "skill", label: "R or Python", values: ["r", "python"] },
    ],
    funding: {
      tuition: { status: "not_covered" },
      living: { status: "covered", note: "Accommodation during field visit" },
      travel: { status: "covered", note: "Field visit travel" },
      paymentTiming: "Reimbursed after field visit",
    },
  },
  {
    ...demo,
    id: "demo-nordlys-exchange",
    title: "Nordlys Semester Exchange",
    organization: "Nordlys University Network (fictional)",
    category: "exchange",
    location: "Tromsø, Norway",
    mode: "in_person",
    summary: "One-semester fictional exchange with courses taught in English.",
    deadline: null,
    tags: ["exchange", "international", "engineering", "design"],
    requirements: [
      {
        id: "r1",
        kind: "degreeLevel",
        label: "Bachelor's or Master's",
        values: ["bachelor", "master"],
      },
      { id: "r2", kind: "language", label: "English", values: ["english"] },
      { id: "r3", kind: "other", label: "Nomination by home university" },
    ],
    funding: {
      tuition: { status: "covered", note: "Tuition waived under exchange" },
      living: { status: "not_covered" },
      travel: { status: "unknown" },
      paymentTiming: null,
    },
  },
  {
    ...demo,
    id: "demo-civic-fellowship",
    title: "Civic Tech Fellowship",
    organization: "Open Commons Lab (fictional)",
    category: "fellowship",
    location: "Remote",
    mode: "remote",
    summary: "Six-month fictional fellowship building open tools for local governments.",
    deadline: "2026-10-28",
    tags: ["civic", "software", "javascript", "design", "computer science"],
    requirements: [
      {
        id: "r1",
        kind: "graduationYear",
        label: "Graduated or graduating 2025–2027",
        min: 2025,
        max: 2027,
      },
      { id: "r2", kind: "skill", label: "JavaScript", values: ["javascript", "typescript"] },
      { id: "r3", kind: "language", label: "English", values: ["english"] },
    ],
    funding: {
      tuition: { status: "not_covered" },
      living: { status: "covered", note: "Fellowship stipend" },
      travel: { status: "not_covered" },
      paymentTiming: "Monthly",
    },
  },
  {
    ...demo,
    id: "demo-aurora-phd-fellowship",
    title: "Aurora Doctoral Research Fellowship",
    organization: "Aurora Science Foundation (fictional)",
    category: "fellowship",
    location: "Montréal, Canada",
    mode: "in_person",
    summary: "Fictional multi-year fellowship for doctoral research in machine learning.",
    deadline: "2026-12-15",
    tags: ["machine learning", "phd", "research", "computer science"],
    requirements: [
      { id: "r1", kind: "degreeLevel", label: "PhD applicant or student", values: ["phd"] },
      {
        id: "r2",
        kind: "field",
        label: "Computer science or related",
        values: ["computer science", "mathematics", "statistics"],
      },
      { id: "r3", kind: "language", label: "English or French", values: ["english", "french"] },
    ],
    funding: {
      tuition: { status: "covered" },
      living: { status: "covered", note: "Annual stipend" },
      travel: { status: "partial", note: "Conference travel only" },
      paymentTiming: null,
    },
  },
];

export const DEMO_PROFILE: Profile = {
  fullName: "Maya (fictional demo)",
  degreeLevel: "bachelor",
  field: "Computer Science",
  graduationYear: 2027,
  skills: ["Python", "SQL", "JavaScript"],
  languages: ["English", "Spanish"],
  preferences: {
    categories: ["internship", "scholarship", "fellowship"],
    locations: ["Europe"],
    remoteOk: true,
  },
  goals: "Gain data and software experience, then pursue a funded master's.",
  fundingNeeds: { tuition: true, living: true, travel: false },
  confirmed: false,
  confirmedAt: null,
  source: "demo",
  education: [
    {
      id: "demo-education",
      degreeLevel: "bachelor",
      degreeName: "Bachelor's degree",
      school: "",
      field: "Computer Science",
    },
  ],
  gpaValue: "",
  gpaScale: "",
  graduationDate: "2027",
  graduationDatePrecision: "year",
  languageDetails: [
    { name: "English", level: "" },
    { name: "Spanish", level: "" },
  ],
  constraints: [],
  fieldProvenance: {},
  sourceDocuments: [],
  fieldEvidence: [],
  workExperience: [],
  experienceSuggestions: [],
};

export const EMPTY_PROFILE: Profile = {
  fullName: "",
  degreeLevel: null,
  field: "",
  graduationYear: null,
  skills: [],
  languages: [],
  preferences: { categories: [], locations: [], remoteOk: false },
  goals: "",
  fundingNeeds: { tuition: false, living: false, travel: false },
  confirmed: false,
  confirmedAt: null,
  source: "manual",
  education: [],
  gpaValue: "",
  gpaScale: "",
  graduationDate: null,
  graduationDatePrecision: null,
  languageDetails: [],
  constraints: [],
  fieldProvenance: {},
  sourceDocuments: [],
  fieldEvidence: [],
  workExperience: [],
  experienceSuggestions: [],
};

// ---------------------------------------------------------------------------
// Recorded research run, replayed by the Evidence Trail while the live web
// search connector is unavailable. Everything below is INVENTED. Hosts use the
// RFC-reserved `.example` TLD so no string here can ever resolve to a real site,
// and the resulting opportunities keep the demo contract: isDemo, demo_unverified,
// and null source/apply URLs.
// ---------------------------------------------------------------------------

/** Builds evidence with the match span derived from the sentence, so spans can't drift. */
function evidence(
  id: string,
  field: string,
  value: string,
  sentence: string,
  match: string,
): TrailEvidence {
  const matchStart = sentence.indexOf(match);
  if (matchStart < 0) throw new Error(`Replay fixture: "${match}" is not in "${sentence}"`);
  return { id, field, value, sentence, matchStart, matchEnd: matchStart + match.length };
}

const REPLAY_QUERY = "funded climate policy fellowship for recent graduates";

const replayOpportunity = (
  o: Pick<
    Opportunity,
    "id" | "title" | "organization" | "category" | "location" | "mode" | "summary" | "deadline"
  > &
    Partial<Opportunity>,
): Opportunity => ({
  ...demo,
  tags: [],
  requirements: [],
  funding: {
    tuition: { status: "unknown" },
    living: { status: "unknown" },
    travel: { status: "unknown" },
    paymentTiming: null,
  },
  ...o,
});

const REPLAY_SOURCES: ReplaySourceSpec[] = [
  {
    source: {
      id: "src-greenhorizon",
      queryId: "q1",
      host: "fellowships.greenhorizon-trust.example",
      path: "/climate-policy/2026-cohort",
      title: "Climate Policy Fellowship 2026, Green Horizon Trust",
    },
    outcome: "kept",
    evidence: [
      evidence(
        "ev-gh-1",
        "Deadline",
        "15 November 2026",
        "Applications for the 2026 cohort close at 23:59 GMT on 15 November 2026.",
        "15 November 2026",
      ),
      evidence(
        "ev-gh-2",
        "Eligibility",
        "Bachelor's or Master's, within 3 years",
        "The fellowship is open to applicants who completed a Bachelor's or Master's degree within the last three years.",
        "completed a Bachelor's or Master's degree within the last three years",
      ),
      evidence(
        "ev-gh-3",
        "Funding",
        "Stipend + tuition covered",
        "Fellows receive a stipend of EUR 32,000 for the year, and the Trust meets tuition and relocation costs in full.",
        "the Trust meets tuition and relocation costs in full",
      ),
    ],
    candidate: {
      id: "cand-greenhorizon",
      sourceId: "src-greenhorizon",
      title: "Climate Policy Fellowship 2026",
      organization: "Green Horizon Trust (fictional)",
      category: "fellowship",
      location: "Brussels, Belgium",
      deadline: "2026-11-15",
    },
    decision: {
      keep: true,
      reason: "Single named fellowship with stated deadline and funding.",
      by: "model",
    },
  },
  {
    source: {
      id: "src-listicle",
      queryId: "q1",
      host: "www.policy-career-guide.example",
      path: "/blog/top-20-climate-fellowships-to-apply-for",
      title: "Top 20 Climate Fellowships You Should Apply To This Year",
    },
    outcome: "rejected",
    evidence: [
      evidence(
        "ev-li-1",
        "Page type",
        "Ranked listing",
        "We have ranked the 20 best climate fellowships available to graduates in 2026.",
        "ranked the 20 best climate fellowships",
      ),
    ],
    candidate: {
      id: "cand-listicle",
      sourceId: "src-listicle",
      title: "Top 20 Climate Fellowships You Should Apply To This Year",
      organization: "Policy Career Guide (fictional)",
      category: "fellowship",
      location: "Not stated",
      deadline: null,
    },
    decision: {
      keep: false,
      reason: "Rankings article, not one specific opportunity.",
      by: "model",
    },
  },
  {
    source: {
      id: "src-northwind",
      queryId: "q1",
      host: "www.northwind-institute.example",
      path: "/programmes/climate-governance-fellows",
      title: "Climate Governance Fellows Programme, Northwind Institute",
    },
    outcome: "kept",
    evidence: [
      evidence(
        "ev-nw-1",
        "Deadline",
        "9 January 2027",
        "The application portal closes on 9 January 2027 for the autumn intake.",
        "9 January 2027",
      ),
      evidence(
        "ev-nw-2",
        "Eligibility",
        "Under 3 years' experience",
        "We welcome early-career applicants with fewer than three years of professional experience in public policy.",
        "fewer than three years of professional experience",
      ),
      evidence(
        "ev-nw-3",
        "Funding",
        "Living costs only",
        "A monthly living allowance is provided; the programme does not cover tuition at the host university.",
        "does not cover tuition at the host university",
      ),
    ],
    candidate: {
      id: "cand-northwind",
      sourceId: "src-northwind",
      title: "Climate Governance Fellows Programme",
      organization: "Northwind Institute (fictional)",
      category: "fellowship",
      location: "Oslo, Norway",
      deadline: "2027-01-09",
    },
    decision: {
      keep: true,
      reason: "Specific programme, early-career, funding partially stated.",
      by: "model",
    },
  },
  {
    source: {
      id: "src-news",
      queryId: "q1",
      host: "www.climate-daily-review.example",
      path: "/2026/09/new-fellowship-announced",
      title: "New climate fellowship announced for graduates",
    },
    outcome: "no_candidate",
    failureReason: "News coverage. No application details on the page",
    evidence: [
      evidence(
        "ev-nd-1",
        "Page type",
        "News article",
        "The foundation said details of how to apply would be published later this year.",
        "details of how to apply would be published later this year",
      ),
    ],
  },
  {
    source: {
      id: "src-aurora",
      queryId: "q2",
      host: "grants.aurora-foundation.example",
      path: "/early-career/climate",
      title: "Early Career Climate Grants, Aurora Foundation",
    },
    outcome: "fetch_failed",
    failureReason: "Fetch blocked by the site (HTTP 403)",
  },
  {
    source: {
      id: "src-meridian",
      queryId: "q2",
      host: "www.meridian-education-trust.example",
      path: "/awards/climate-leaders",
      title: "Climate Leaders Award, Meridian Education Trust",
    },
    outcome: "rejected",
    evidence: [
      evidence(
        "ev-me-1",
        "Page type",
        "Prize, not an application",
        "The award recognises work already completed; nominations are made by partner universities.",
        "nominations are made by partner universities",
      ),
    ],
    candidate: {
      id: "cand-meridian",
      sourceId: "src-meridian",
      title: "Climate Leaders Award",
      organization: "Meridian Education Trust (fictional)",
      category: "scholarship",
      location: "Any partner university",
      deadline: null,
    },
    decision: {
      keep: false,
      reason: "Nomination-only prize; students cannot apply directly.",
      by: "model",
    },
  },
  {
    source: {
      id: "src-tidewater",
      queryId: "q3",
      host: "www.tidewater-institute.example",
      path: "/fellowships/coastal-climate-policy",
      title: "Coastal Climate Policy Fellowship, Tidewater Field Institute",
    },
    outcome: "kept",
    evidence: [
      evidence(
        "ev-tw-1",
        "Deadline",
        "2 December 2026",
        "Complete applications must be received by 2 December 2026.",
        "2 December 2026",
      ),
      evidence(
        "ev-tw-2",
        "Funding",
        "Fully funded",
        "This is a fully funded fellowship covering tuition, accommodation and a research budget.",
        "fully funded fellowship covering tuition, accommodation and a research budget",
      ),
      evidence(
        "ev-tw-3",
        "Eligibility",
        "Recent graduates",
        "Applicants must have graduated within the previous two academic years.",
        "graduated within the previous two academic years",
      ),
    ],
    candidate: {
      id: "cand-tidewater",
      sourceId: "src-tidewater",
      title: "Coastal Climate Policy Fellowship",
      organization: "Tidewater Field Institute (fictional)",
      category: "fellowship",
      location: "Remote + 3-week field placement",
      deadline: "2026-12-02",
    },
    decision: {
      keep: true,
      reason: "Fully funded, open to recent graduates, deadline stated.",
      by: "model",
    },
  },
  {
    source: {
      id: "src-aggregator",
      queryId: "q3",
      host: "search.study-portal-index.example",
      path: "/results?topic=climate-policy",
      title: "Search results: climate policy (412 programmes)",
    },
    outcome: "rejected",
    evidence: [
      evidence(
        "ev-ag-1",
        "Page type",
        "Search results",
        "Showing 1-20 of 412 programmes matching your search.",
        "412 programmes matching your search",
      ),
    ],
    candidate: {
      id: "cand-aggregator",
      sourceId: "src-aggregator",
      title: "Search results: climate policy (412 programmes)",
      organization: "Study Portal Index (fictional)",
      category: "masters",
      location: "Not stated",
      deadline: null,
    },
    decision: {
      keep: false,
      reason: "Aggregator search page, not an opportunity.",
      by: "rules",
    },
  },
];

export const RESEARCH_REPLAY: ResearchReplayFixture = {
  query: REPLAY_QUERY,
  queries: [
    {
      id: "q1",
      text: "climate policy fellowship 2026 recent graduates funded application",
      refinement: false,
    },
    {
      id: "q2",
      text: "early career climate governance fellowship stipend how to apply",
      refinement: false,
    },
    {
      id: "q3",
      text: "fully funded climate policy fellowship graduates deadline 2026",
      refinement: true,
    },
  ],
  sources: REPLAY_SOURCES,
  refineQuery: "fully funded climate policy fellowship graduates deadline 2026",
  rankedCandidateIds: ["cand-tidewater", "cand-greenhorizon", "cand-northwind"],
  opportunities: {
    "cand-greenhorizon": replayOpportunity({
      id: "replay-greenhorizon-climate-fellowship",
      title: "Climate Policy Fellowship 2026",
      organization: "Green Horizon Trust (fictional)",
      category: "fellowship",
      location: "Brussels, Belgium",
      mode: "in_person",
      summary:
        "Fictional one-year policy fellowship for graduates within three years of completing a Bachelor's or Master's.",
      deadline: "2026-11-15",
      tags: ["climate", "policy", "public policy", "environment"],
      requirements: [
        {
          id: "r1",
          kind: "degreeLevel",
          label: "Bachelor's or Master's completed",
          values: ["bachelor", "master"],
        },
        { id: "r2", kind: "language", label: "English", values: ["english"] },
        { id: "r3", kind: "other", label: "Graduated within the last three years" },
      ],
      funding: {
        tuition: { status: "covered" },
        living: { status: "covered", note: "EUR 32,000 annual stipend stated on the page" },
        travel: { status: "partial", note: "Relocation costs stated; ongoing travel unknown" },
        paymentTiming: "Monthly",
      },
    }),
    "cand-northwind": replayOpportunity({
      id: "replay-northwind-governance-fellows",
      title: "Climate Governance Fellows Programme",
      organization: "Northwind Institute (fictional)",
      category: "fellowship",
      location: "Oslo, Norway",
      mode: "hybrid",
      summary:
        "Fictional fellowship for early-career applicants with fewer than three years of policy experience.",
      deadline: "2027-01-09",
      tags: ["climate", "governance", "policy"],
      requirements: [
        { id: "r1", kind: "other", label: "Fewer than three years of professional experience" },
        { id: "r2", kind: "language", label: "English", values: ["english"] },
      ],
      funding: {
        tuition: { status: "not_covered" },
        living: { status: "covered", note: "Monthly living allowance stated" },
        travel: { status: "unknown" },
        paymentTiming: "Monthly",
      },
    }),
    "cand-tidewater": replayOpportunity({
      id: "replay-tidewater-coastal-policy",
      title: "Coastal Climate Policy Fellowship",
      organization: "Tidewater Field Institute (fictional)",
      category: "fellowship",
      location: "Remote + 3-week field placement",
      mode: "remote",
      summary:
        "Fictional fully funded fellowship pairing remote policy work with a short coastal field placement.",
      deadline: "2026-12-02",
      tags: ["climate", "policy", "coastal", "research"],
      requirements: [
        { id: "r1", kind: "other", label: "Graduated within the previous two academic years" },
        { id: "r2", kind: "language", label: "English", values: ["english"] },
      ],
      funding: {
        tuition: { status: "covered" },
        living: { status: "covered", note: "Accommodation covered during the field placement" },
        travel: { status: "covered", note: "Research budget stated on the page" },
        paymentTiming: "Not stated",
      },
    }),
  },
};
