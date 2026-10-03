import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { FileText, LockKeyhole, Plus, Trash2, Upload, WandSparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useStore } from "@/lib/store";
import { EMPTY_PROFILE } from "@/data/fixtures";
import {
  CATEGORY_LABELS,
  DEGREE_LABELS,
  type Category,
  type DocumentExtractionResult,
  type DocumentLabel,
  type DegreeLevel,
  type Profile,
} from "@/domain/types";
import { Loading, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { extractProfile, extractWebProfile } from "@/lib/profileExtraction.functions";
import { ExperienceEditor } from "@/components/ExperienceEditor";
import {
  applyExtractedCandidates,
  canConfirmProfile,
  extractionConflicts,
  fieldLabel,
  normalizeWebSourceUrl,
  webSourceLabel,
} from "@/lib/profileExtraction";

export const Route = createFileRoute("/passport")({
  head: () => ({
    meta: [
      { title: "Create your Opportunity Passport — OpportunityOS" },
      {
        name: "description",
        content: "Build and confirm your student profile from documents or manual entry.",
      },
      { property: "og:title", content: "Create your Opportunity Passport — OpportunityOS" },
      {
        property: "og:description",
        content: "Build and confirm your student profile from documents or manual entry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Passport,
});

type IntakeDocument = {
  id: string;
  name: string;
  label: DocumentLabel;
  kind: "pdf" | "text";
  file?: File;
  text?: string;
  state: "ready" | "extracting" | "done" | "error";
  error?: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const list = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);

async function fileBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function Passport() {
  const { ready, profile, saveProfile, loadDemoProfile, profileDraft, setProfileDraft } =
    useStore();
  const extract = useServerFn(extractProfile);
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Profile>(() => profileDraft ?? profile ?? EMPTY_PROFILE);
  const [documents, setDocuments] = useState<IntakeDocument[]>([]);
  const [results, setResults] = useState<DocumentExtractionResult[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteName, setPasteName] = useState("Pasted notes");
  const [pasteText, setPasteText] = useState("");
  const [pasteLabel, setPasteLabel] = useState<DocumentLabel>("other");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const extractWeb = useServerFn(extractWebProfile);
  const [webUrl, setWebUrl] = useState("");
  const [webConsent, setWebConsent] = useState(false);
  const [webBusy, setWebBusy] = useState(false);
  const [webError, setWebError] = useState("");

  useEffect(() => {
    if (!ready) return;
    setDraft(profileDraft ?? profile ?? EMPTY_PROFILE);
  }, [ready, profile, profileDraft]);

  const conflicts = useMemo(() => extractionConflicts(results), [results]);
  const unresolved = conflicts.filter((item) => !choices[item.field]).length;
  const confirmation = canConfirmProfile(draft, unresolved);
  const hasDraft =
    profileDraft !== null || JSON.stringify(draft) !== JSON.stringify(profile ?? EMPTY_PROFILE);

  if (!ready) return <Loading />;

  const persistDraft = (next: Profile) => {
    setDraft(next);
    setProfileDraft({ ...next, confirmed: false, confirmedAt: null });
  };

  const manual = (field: string, next: Profile) => {
    persistDraft({
      ...next,
      fieldProvenance: { ...next.fieldProvenance, [field]: "manual" },
      fieldEvidence: next.fieldEvidence.filter((item) => item.field !== field),
      source: next.source === "demo" ? "demo" : "manual",
    });
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = [...(event.target.files ?? [])];
    const available = 3 - documents.length;
    const accepted: IntakeDocument[] = [];
    const errors: string[] = [];
    for (const file of incoming.slice(0, available)) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        errors.push(`${file.name}: only PDF files are supported.`);
      } else if (file.size > 5 * 1024 * 1024) {
        errors.push(`${file.name}: file is larger than 5 MB.`);
      } else if (file.size === 0) {
        errors.push(`${file.name}: file is empty.`);
      } else {
        accepted.push({
          id: uid(),
          name: file.name,
          label: "cv",
          kind: "pdf",
          file,
          state: "ready",
        });
      }
    }
    if (incoming.length > available) errors.push("You can add up to 3 documents.");
    setDocuments((current) => [...current, ...accepted]);
    setMessage(errors.join(" "));
    event.target.value = "";
  };

  const addPasted = () => {
    if (!pasteText.trim()) return setMessage("Paste some document text first.");
    if (documents.length >= 3) return setMessage("You can add up to 3 documents.");
    setDocuments((current) => [
      ...current,
      {
        id: uid(),
        name: pasteName.trim() || "Pasted text",
        label: pasteLabel,
        kind: "text",
        text: pasteText.trim(),
        state: "ready",
      },
    ]);
    setPasteText("");
    setPasteOpen(false);
    setMessage("");
  };

  const runExtraction = async () => {
    if (!documents.length) return setMessage("Add at least one PDF or pasted document first.");
    setSaving(true);
    setMessage("");
    const collected: DocumentExtractionResult[] = [];
    for (const document of documents) {
      setDocuments((current) =>
        current.map((item) => (item.id === document.id ? { ...item, state: "extracting" } : item)),
      );
      try {
        const content =
          document.kind === "pdf" && document.file
            ? await fileBase64(document.file)
            : (document.text ?? "");
        const result = await extract({
          data: {
            name: document.name,
            label: document.label,
            mimeType: document.kind === "pdf" ? "application/pdf" : "text/plain",
            content,
          },
        });
        collected.push(result);
        setDocuments((current) =>
          current.map((item) =>
            item.id === document.id
              ? {
                  ...item,
                  state: result.ok ? "done" : "error",
                  ...(result.error ? { error: result.error } : {}),
                }
              : item,
          ),
        );
      } catch {
        const result: DocumentExtractionResult = {
          ok: false,
          document: { name: document.name, label: document.label },
          candidates: [],
          warnings: [],
          error:
            "Automatic extraction is unavailable. You can retry or enter the details manually.",
        };
        collected.push(result);
        setDocuments((current) =>
          current.map((item) =>
            item.id === document.id
              ? { ...item, state: "error", ...(result.error ? { error: result.error } : {}) }
              : item,
          ),
        );
      }
    }
    setResults(collected);
    const next = applyExtractedCandidates(profileDraft ?? profile ?? EMPTY_PROFILE, collected);
    persistDraft(next);
    setSaving(false);
    setMessage(
      collected.some((item) => item.ok)
        ? "Extraction finished. Review every value and resolve any conflicts."
        : "Automatic extraction did not return any values. You can retry or continue manually.",
    );
  };

  const readWebLink = async () => {
    const url = normalizeWebSourceUrl(webUrl);
    if (!url) return setWebError("Enter a full public link, like https://github.com/yourname.");
    if (!webConsent) return setWebError("Tick the box to confirm this link is yours.");
    setWebBusy(true);
    setWebError("");
    try {
      const result = await extractWeb({
        data: { url, label: webSourceLabel(url), consent: true },
      });
      if (!result.ok) {
        setWebError(result.error ?? "This page could not be read.");
      } else {
        const nextResults = [...results, result];
        setResults(nextResults);
        persistDraft(applyExtractedCandidates(draft, [result], choices));
        const found = result.experiences?.length ?? 0;
        setMessage(
          `Read ${url}. ${found} ${found === 1 ? "role was" : "roles were"} found and added as suggestions below for you to accept or dismiss.`,
        );
        setWebUrl("");
        setWebConsent(false);
      }
    } catch {
      setWebError("This page could not be read. You can paste the text instead.");
    } finally {
      setWebBusy(false);
    }
  };

  const chooseConflict = (field: string, value: string) => {
    const nextChoices = { ...choices, [field]: value };
    setChoices(nextChoices);
    persistDraft(applyExtractedCandidates(draft, results, nextChoices));
  };

  const makeProfile = () => {
    if (!confirmation.ok) return setMessage(confirmation.reason);
    const now = new Date().toISOString();
    saveProfile({ ...draft, confirmed: true, confirmedAt: now });
    setDraft((current) => ({ ...current, confirmed: true, confirmedAt: now }));
    setMessage("Profile made and confirmed. Matching can now use it.");
  };

  const education = draft.education[0] ?? {
    id: "education-primary",
    degreeLevel: null,
    degreeName: "",
    school: "",
    field: "",
  };
  const updateEducation = (patch: Partial<typeof education>, field: string) => {
    const nextEducation = { ...education, ...patch };
    manual(field, {
      ...draft,
      education: [nextEducation, ...draft.education.slice(1)],
      degreeLevel: nextEducation.degreeLevel,
      field: nextEducation.field,
    });
  };

  return (
    <>
      <PageHeader
        title="Make your Opportunity Passport"
        sub="Upload papers or enter details yourself. Nothing is assumed, and matching uses only the profile you confirm."
        right={
          <Button
            variant="outline"
            onClick={() => {
              loadDemoProfile();
              setDraft({ ...EMPTY_PROFILE });
              setMessage("Loaded the fictional Maya demo profile. Refresh to view it.");
            }}
          >
            Load demo profile
          </Button>
        }
      />

      <ol
        className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5"
        aria-label="Profile creation steps"
      >
        {["Upload", "Extract", "Review", "Fill gaps", "Make profile"].map((step, index) => (
          <li
            key={step}
            className={`profile-step ${index <= (results.length ? 3 : documents.length ? 1 : 0) ? "profile-step-active" : ""}`}
          >
            <span>{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      {profile?.confirmed && (
        <div className="action-band mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong>Confirmed profile remains active</strong>
            <p className="text-sm text-muted-foreground">
              Your new upload and edits stay separate until you press Make profile.
            </p>
          </div>
          <span className="chip chip-met">
            Confirmed{" "}
            {profile.confirmedAt ? new Date(profile.confirmedAt).toLocaleDateString() : ""}
          </span>
        </div>
      )}
      {message && (
        <p role="status" className="mb-5 rounded-md bg-teal-soft p-3 text-sm">
          {message}
        </p>
      )}

      <section className="mb-8 border-y border-border py-6" aria-labelledby="documents-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Steps 1–2</p>
            <h2 id="documents-title" className="mt-1 text-2xl">
              Add your documents
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Up to 3 PDFs, 5 MB each, or pasted text. Label each document yourself.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={addFiles}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={documents.length >= 3}
            >
              <Upload />
              Add PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => setPasteOpen((open) => !open)}
              disabled={documents.length >= 3}
            >
              <Plus />
              Paste text
            </Button>
          </div>
        </div>
        {pasteOpen && (
          <div className="mt-5 grid gap-3 border-l-2 border-primary pl-4 md:grid-cols-[1fr_160px]">
            <F id="paste-name" label="Document name">
              <input
                id="paste-name"
                value={pasteName}
                onChange={(event) => setPasteName(event.target.value)}
              />
            </F>
            <F id="paste-label" label="Document label">
              <select
                id="paste-label"
                value={pasteLabel}
                onChange={(event) => setPasteLabel(event.target.value as DocumentLabel)}
              >
                <option value="cv">CV</option>
                <option value="transcript">Transcript</option>
                <option value="other">Other</option>
              </select>
            </F>
            <F id="paste-text" label="Document text" className="md:col-span-2">
              <textarea
                id="paste-text"
                rows={6}
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                placeholder="Paste the document exactly as written…"
              />
            </F>
            <div>
              <Button onClick={addPasted}>Add pasted document</Button>
            </div>
          </div>
        )}
        <div className="mt-5 grid gap-3">
          {!documents.length && (
            <div className="border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
              No documents added. Manual entry is always available below.
            </div>
          )}
          {documents.map((document) => (
            <div
              key={document.id}
              className="flex flex-wrap items-center gap-3 border-b border-border py-3"
            >
              <FileText className="size-5 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{document.name}</p>
                <p className="text-xs text-muted-foreground">
                  {document.kind === "pdf" ? "PDF" : "Pasted text"} ·{" "}
                  {document.state === "extracting"
                    ? "Extracting…"
                    : document.state === "done"
                      ? "Extracted"
                      : document.state === "error"
                        ? "Needs attention"
                        : "Ready"}
                </p>
                {document.error && <p className="field-error">{document.error}</p>}
              </div>
              <select
                aria-label={`Label ${document.name}`}
                className="w-36"
                value={document.label}
                onChange={(event) =>
                  setDocuments((current) =>
                    current.map((item) =>
                      item.id === document.id
                        ? { ...item, label: event.target.value as DocumentLabel }
                        : item,
                    ),
                  )
                }
              >
                <option value="cv">CV</option>
                <option value="transcript">Transcript</option>
                <option value="other">Other</option>
              </select>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove ${document.name}`}
                onClick={() =>
                  setDocuments((current) => current.filter((item) => item.id !== document.id))
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={runExtraction} disabled={saving || !documents.length}>
            <WandSparkles />
            {saving ? "Extracting documents…" : "Extract details"}
          </Button>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <LockKeyhole className="size-3" />
            Files are processed privately and deleted after extraction.
          </span>
        </div>
      </section>

      <section className="mb-8 border-b border-border pb-6" aria-labelledby="web-title">
        <p className="eyebrow">Optional</p>
        <h2 id="web-title" className="mt-1 text-2xl">
          Add your own web link
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          LinkedIn, GitHub, a personal site or another public page about you. We read only the link
          you give, never search for your name, and don't keep the page text.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="web-url">Link</label>
            <input
              id="web-url"
              className="mt-1"
              inputMode="url"
              placeholder="https://www.linkedin.com/in/yourname"
              value={webUrl}
              onChange={(event) => setWebUrl(event.target.value)}
            />
          </div>
          <Button type="button" onClick={readWebLink} disabled={webBusy}>
            {webBusy ? "Reading link…" : "Read link"}
          </Button>
        </div>
        <label className="mt-3 flex items-start gap-2 font-normal">
          <input
            type="checkbox"
            className="mt-1 w-auto"
            checked={webConsent}
            onChange={(event) => setWebConsent(event.target.checked)}
          />
          <span className="text-sm">This link is about me, and I agree to it being read once.</span>
        </label>
        {webError && (
          <p role="alert" className="mt-3 text-sm text-warning-strong">
            {webError}
          </p>
        )}
      </section>

      {conflicts.length > 0 && (
        <section
          className="mb-8 border-l-2 border-warning-strong bg-warning-soft p-5"
          aria-labelledby="conflicts-title"
        >
          <p className="eyebrow">Needs your choice</p>
          <h2 id="conflicts-title" className="mt-1 text-xl">
            Resolve document conflicts
          </h2>
          <div className="mt-4 grid gap-5">
            {conflicts.map((conflict) => (
              <fieldset key={conflict.field}>
                <legend className="font-semibold">{fieldLabel(conflict.field)}</legend>
                <div className="mt-2 grid gap-2">
                  {conflict.candidates.map((candidate, index) => (
                    <label
                      key={`${candidate.sourceFile}-${index}`}
                      className="flex cursor-pointer gap-3 border border-border bg-card p-3 font-normal"
                    >
                      <input
                        className="mt-1 w-auto"
                        type="radio"
                        name={conflict.field}
                        checked={choices[conflict.field] === candidate.value}
                        onChange={() => chooseConflict(conflict.field, candidate.value)}
                      />
                      <span>
                        <strong>{candidate.value}</strong>
                        <span className="block text-xs text-muted-foreground">
                          {candidate.sourceFile}: “{candidate.snippet}”
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="review-title">
        <p className="eyebrow">Steps 3–5</p>
        <h2 id="review-title" className="mt-1 text-2xl">
          Review and fill the gaps
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Correct anything that is wrong. Blank values remain unknown.
        </p>
        <form
          className="mt-5 grid gap-x-6 gap-y-5 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            makeProfile();
          }}
        >
          <F id="fullName" label="Name">
            <input
              id="fullName"
              value={draft.fullName}
              onChange={(event) => manual("fullName", { ...draft, fullName: event.target.value })}
            />
            <Evidence field="fullName" profile={draft} />
          </F>
          <F id="school" label="School">
            <input
              id="school"
              value={education.school}
              onChange={(event) => updateEducation({ school: event.target.value }, "school")}
            />
            <Evidence field="school" profile={draft} />
          </F>
          <F id="degree" label="Degree">
            <input
              id="degree"
              value={education.degreeName}
              placeholder="e.g. Bachelor of Science"
              onChange={(event) =>
                updateEducation({ degreeName: event.target.value }, "degreeName")
              }
            />
            <Evidence field="degreeName" profile={draft} />
          </F>
          <F id="degreeLevel" label="Degree level">
            <select
              id="degreeLevel"
              value={education.degreeLevel ?? ""}
              onChange={(event) =>
                updateEducation(
                  { degreeLevel: (event.target.value || null) as DegreeLevel | null },
                  "degreeLevel",
                )
              }
            >
              <option value="">Unknown</option>
              {Object.entries(DEGREE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <Evidence field="degreeLevel" profile={draft} />
          </F>
          <F id="field" label="Field of study">
            <input
              id="field"
              value={education.field}
              onChange={(event) => updateEducation({ field: event.target.value }, "field")}
            />
            <Evidence field="field" profile={draft} />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F id="gpaValue" label="GPA value">
              <input
                id="gpaValue"
                value={draft.gpaValue}
                placeholder="Unknown"
                onChange={(event) => manual("gpaValue", { ...draft, gpaValue: event.target.value })}
              />
            </F>
            <F id="gpaScale" label="GPA scale">
              <input
                id="gpaScale"
                value={draft.gpaScale}
                placeholder="e.g. 4.0"
                onChange={(event) => manual("gpaScale", { ...draft, gpaScale: event.target.value })}
              />
            </F>
          </div>
          <div className="grid grid-cols-[1fr_130px] gap-3">
            <F id="graduationDate" label="Graduation date">
              <input
                id="graduationDate"
                value={draft.graduationDate ?? ""}
                placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
                onChange={(event) =>
                  manual("graduationDate", {
                    ...draft,
                    graduationDate: event.target.value || null,
                    graduationYear: Number(event.target.value.slice(0, 4)) || null,
                  })
                }
              />
            </F>
            <F id="graduationPrecision" label="Precision">
              <select
                id="graduationPrecision"
                value={draft.graduationDatePrecision ?? ""}
                onChange={(event) =>
                  manual("graduationDatePrecision", {
                    ...draft,
                    graduationDatePrecision: (event.target.value ||
                      null) as Profile["graduationDatePrecision"],
                  })
                }
              >
                <option value="">Unknown</option>
                <option value="year">Year</option>
                <option value="month">Month</option>
                <option value="day">Day</option>
              </select>
            </F>
          </div>
          <F id="skills" label="Skills (comma separated)">
            <input
              id="skills"
              value={draft.skills.join(", ")}
              onChange={(event) => manual("skills", { ...draft, skills: list(event.target.value) })}
            />
            <Evidence field="skill" profile={draft} />
          </F>
          <F id="languages" label="Languages (one per line; level optional)">
            <textarea
              id="languages"
              rows={3}
              value={draft.languageDetails
                .map((item) => `${item.name}${item.level ? ` — ${item.level}` : ""}`)
                .join("\n")}
              onChange={(event) => {
                const languageDetails = event.target.value
                  .split("\n")
                  .map((line) => line.split(/\s+[—-]\s+/, 2))
                  .filter(([name]) => name?.trim())
                  .map(([name, level]) => ({ name: name!.trim(), level: level?.trim() ?? "" }));
                manual("languages", {
                  ...draft,
                  languageDetails,
                  languages: languageDetails.map((item) => item.name),
                });
              }}
            />
            <Evidence field="language" profile={draft} />
          </F>

          <div className="border-t border-border pt-5 md:col-span-2">
            <h3 className="text-xl">Your choices and constraints</h3>
            <p className="text-sm text-muted-foreground">
              These are never extracted from your documents.
            </p>
          </div>
          <F id="constraints" label="Constraints (comma separated)">
            <input
              id="constraints"
              value={draft.constraints.join(", ")}
              placeholder="Optional — visa, budget, schedule"
              onChange={(event) =>
                manual("constraints", { ...draft, constraints: list(event.target.value) })
              }
            />
          </F>
          <F id="locations" label="Preferred locations (comma separated)">
            <input
              id="locations"
              value={draft.preferences.locations.join(", ")}
              onChange={(event) =>
                manual("preferences", {
                  ...draft,
                  preferences: { ...draft.preferences, locations: list(event.target.value) },
                })
              }
            />
          </F>
          <fieldset className="md:col-span-2">
            <legend className="text-sm font-semibold">Preferred categories</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((category) => (
                <Button
                  type="button"
                  size="sm"
                  variant={draft.preferences.categories.includes(category) ? "default" : "outline"}
                  key={category}
                  aria-pressed={draft.preferences.categories.includes(category)}
                  onClick={() =>
                    manual("preferences", {
                      ...draft,
                      preferences: {
                        ...draft.preferences,
                        categories: draft.preferences.categories.includes(category)
                          ? draft.preferences.categories.filter((item) => item !== category)
                          : [...draft.preferences.categories, category],
                      },
                    })
                  }
                >
                  {CATEGORY_LABELS[category]}
                </Button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 font-normal">
            <input
              type="checkbox"
              className="w-auto"
              checked={draft.preferences.remoteOk}
              onChange={(event) =>
                manual("preferences", {
                  ...draft,
                  preferences: { ...draft.preferences, remoteOk: event.target.checked },
                })
              }
            />
            Open to remote opportunities
          </label>
          <fieldset>
            <legend className="text-sm font-semibold">Funding needs</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {(["tuition", "living", "travel"] as const).map((key) => (
                <label key={key} className="flex items-center gap-2 font-normal capitalize">
                  <input
                    type="checkbox"
                    className="w-auto"
                    checked={draft.fundingNeeds[key]}
                    onChange={(event) =>
                      manual("fundingNeeds", {
                        ...draft,
                        fundingNeeds: { ...draft.fundingNeeds, [key]: event.target.checked },
                      })
                    }
                  />
                  {key}
                </label>
              ))}
            </div>
          </fieldset>
          <ExperienceEditor profile={draft} onChange={(next) => manual("workExperience", next)} />
          <F id="goals" label="Goals" className="md:col-span-2">
            <textarea
              id="goals"
              rows={3}
              value={draft.goals}
              onChange={(event) => manual("goals", { ...draft, goals: event.target.value })}
            />
          </F>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5 md:col-span-2">
            <Button type="submit" disabled={!confirmation.ok || saving}>
              Make profile
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setProfileDraft({ ...draft, confirmed: false, confirmedAt: null });
                setMessage("Draft saved. Your confirmed profile was not replaced.");
              }}
            >
              Save review draft
            </Button>
            {!confirmation.ok && (
              <p className="text-sm text-warning-strong">{confirmation.reason}</p>
            )}
            {hasDraft && profile?.confirmed && (
              <span className="chip chip-unknown">Confirmed profile unchanged</span>
            )}
          </div>
        </form>
      </section>
    </>
  );
}

function Evidence({ field, profile }: { field: string; profile: Profile }) {
  const entries = profile.fieldEvidence.filter((item) => item.field === field);
  if (!entries.length) return null;
  return (
    <div className="mt-2 space-y-1">
      {entries.map((item, index) => (
        <p key={`${item.sourceFile}-${index}`} className="text-xs text-muted-foreground">
          <span className="font-semibold text-primary">Extracted from {item.sourceFile}</span> · “
          {item.snippet}”
        </p>
      ))}
    </div>
  );
}

function F({
  id,
  label,
  children,
  className = "",
}: {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
