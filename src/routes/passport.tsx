import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExperienceEditor } from "@/components/ExperienceEditor";
import { StepUpload } from "@/components/passport/StepUpload";
import { StepExtract } from "@/components/passport/StepExtract";
import { StepReview } from "@/components/passport/StepReview";
import { StepGaps } from "@/components/passport/StepGaps";
import { ProfileCreated, StepConfirm } from "@/components/passport/StepConfirm";
import { PassportActions } from "@/components/passport/PassportActions";
import { F, MultiSelect } from "@/components/passport/fields";
import { fileBase64, type IntakeDocument } from "@/components/passport/shared";
import { LANGUAGE_OPTIONS, LOCATION_OPTIONS, SKILL_OPTIONS } from "@/lib/curatedOptions";
import { EMPTY_PROFILE } from "@/data/fixtures";
import type { DocumentExtractionResult, EducationEntry, Profile } from "@/domain/types";
import { DEGREE_LABELS, type DegreeLevel } from "@/domain/types";
import { extractProfile, extractWebProfile } from "@/lib/profileExtraction.functions";
import {
  applyExtractedCandidates,
  canConfirmProfile,
  extractionConflicts,
  webSourceLabel,
  normalizeEmail,
} from "@/lib/profileExtraction";
import { useStore } from "@/lib/store";

const STEPS = [
  "Upload sources",
  "Extract details",
  "Review information",
  "Fill gaps",
  "Confirm profile",
] as const;

export const Route = createFileRoute("/passport")({
  head: () => ({
    meta: [
      { title: "Opportunity Passport — Source" },
      {
        name: "description",
        content:
          "Build your student profile step by step: upload documents, review what we find, fill the gaps, and confirm. Saved privately in your browser.",
      },
      { property: "og:title", content: "Opportunity Passport — Source" },
      {
        property: "og:description",
        content:
          "Build your student profile step by step: upload documents, review what we find, fill the gaps, and confirm. Saved privately in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Passport,
});

function Passport() {
  const {
    ready,
    profile,
    saveProfile,
    loadDemoProfile,
    profileDraft,
    setProfileDraft,
    deleteProfile,
    pendingProfileEdits,
  } = useStore();
  const runExtractionFn = useServerFn(extractProfile);
  const runWebExtraction = useServerFn(extractWebProfile);

  const [step, setStep] = useState(0);
  const [created, setCreated] = useState(false);
  const [deletedNotice, setDeletedNotice] = useState(false);
  const [documents, setDocuments] = useState<IntakeDocument[]>([]);
  const [results, setResults] = useState<DocumentExtractionResult[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [webBusy, setWebBusy] = useState(false);
  const [webError, setWebError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const draft: Profile = useMemo(
    () => profileDraft ?? profile ?? EMPTY_PROFILE,
    [profileDraft, profile],
  );

  const stampSaved = () =>
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

  /** Every draft change persists as the review draft (confirmed stays false until step 5). */
  const persistDraft = (next: Profile) => {
    setProfileDraft({ ...next, confirmed: false, confirmedAt: null });
    stampSaved();
  };

  const manual = (field: string, next: Profile) =>
    persistDraft({
      ...next,
      fieldProvenance: { ...next.fieldProvenance, [field]: "manual" },
      fieldEvidence: (next.fieldEvidence ?? []).filter((item) => item.field !== field),
    });

  const updateEducation = (patch: Partial<EducationEntry>) => {
    const education = draft.education[0] ?? {
      id: "education-primary",
      degreeLevel: null,
      degreeName: "",
      school: "",
      field: "",
    };
    const next: Profile = {
      ...draft,
      education: [{ ...education, ...patch }, ...draft.education.slice(1)],
    };
    const keys = Object.keys(patch);
    if (!keys.length) return persistDraft(next);
    let updated = next;
    for (const key of keys) {
      updated = {
        ...updated,
        fieldProvenance: { ...updated.fieldProvenance, [key]: "manual" },
        fieldEvidence: (updated.fieldEvidence ?? []).filter((item) => item.field !== key),
      };
    }
    persistDraft(updated);
  };

  const readWebLink = async (normalizedUrl: string) => {
    setWebBusy(true);
    setWebError("");
    try {
      const result = await runWebExtraction({
        data: { url: normalizedUrl, label: webSourceLabel(normalizedUrl), consent: true },
      });
      if (result.error) return setWebError(result.error);
      const nextResults = [...results, result];
      setResults(nextResults);
      const conflicts = extractionConflicts(nextResults);
      const nextChoices = { ...choices };
      for (const conflict of conflicts)
        if (!(conflict.field in nextChoices)) nextChoices[conflict.field] = "";
      setChoices(nextChoices);
      persistDraft(applyExtractedCandidates(draft, [result], nextChoices));
    } catch {
      setWebError("We couldn't read that link. Check the address and try again.");
    } finally {
      setWebBusy(false);
    }
  };

  const runExtraction = async () => {
    const readyDocuments = documents.filter((document) => document.state === "ready");
    if (!readyDocuments.length) {
      // Web links are read and extracted immediately, so there is nothing left to do —
      // go straight to the review step.
      if (results.some((r) => r.ok)) setStep(2);
      return;
    }
    setExtracting(true);
    setMessage("");
    setStep(1);
    const all: DocumentExtractionResult[] = [];
    for (const document of readyDocuments) {
      setDocuments((current) =>
        current.map((item) =>
          item.id === document.id ? { ...item, state: "extracting", error: undefined } : item,
        ),
      );
      try {
        const input =
          document.kind === "pdf" && document.file
            ? {
                name: document.name,
                label: document.label,
                mimeType: "application/pdf" as const,
                content: await fileBase64(document.file),
              }
            : {
                name: document.name,
                label: document.label,
                mimeType: "text/plain" as const,
                content: document.text ?? "",
              };
        const result = await runExtractionFn({ data: input });
        all.push(result);
        setDocuments((current) =>
          current.map((item) =>
            item.id === document.id
              ? {
                  ...item,
                  state: result.error ? "error" : "done",
                  error: result.error ?? undefined,
                }
              : item,
          ),
        );
      } catch {
        all.push({
          ok: false,
          document: { name: document.name, label: document.label },
          candidates: [],
          warnings: [],
          error: "extraction failed",
        });
        setDocuments((current) =>
          current.map((item) =>
            item.id === document.id
              ? { ...item, state: "error", error: "extraction failed" }
              : item,
          ),
        );
      }
    }
    const nextResults = [...results, ...all];
    setResults(nextResults);
    const conflicts = extractionConflicts(nextResults);
    const nextChoices = { ...choices };
    for (const conflict of conflicts)
      if (!(conflict.field in nextChoices)) nextChoices[conflict.field] = "";
    setChoices(nextChoices);
    persistDraft(applyExtractedCandidates(draft, all, nextChoices));
    setExtracting(false);
  };

  const chooseConflict = (field: string, value: string) => {
    const nextChoices = { ...choices, [field]: value };
    setChoices(nextChoices);
    persistDraft(applyExtractedCandidates(draft, results, nextChoices));
  };

  const conflicts = useMemo(() => extractionConflicts(results), [results]);
  const unresolvedConflicts = conflicts.filter(
    (conflict) => !(conflict.field in choices) || choices[conflict.field] === undefined,
  ).length;

  const confirm = () => {
    const check = canConfirmProfile(draft, unresolvedConflicts);
    if (!check.ok) return setMessage(check.reason);
    setSaving(true);
    saveProfile({ ...draft, confirmed: true, confirmedAt: new Date().toISOString() });
    setSaving(false);
    setCreated(true);
  };

  const hasSource =
    documents.some((document) => document.state !== "error") || results.some((r) => r.ok);

  // Resume at the review step when a saved profile or draft already has content.
  const resumed = useRef(false);
  useEffect(() => {
    if (!ready || resumed.current) return;
    resumed.current = true;
    const hasContent =
      draft.fullName.trim().length > 0 ||
      draft.education.some((entry) => entry.degreeName || entry.school || entry.field) ||
      draft.skills.length > 0;
    if (hasContent) setStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return null;

  const handleDelete = () => {
    const failure = deleteProfile();
    if (failure) return failure;
    setCreated(false);
    setDocuments([]);
    setResults([]);
    setChoices({});
    setSavedAt(null);
    setStep(0);
    setMessage("");
    setDeletedNotice(true);
    return null;
  };

  if (created) {
    return (
      <div className="mx-auto max-w-[760px]">
        <ProfileCreated name={draft.fullName} />
        <PassportActions
          canRecommend={Boolean(profile?.confirmed) && !pendingProfileEdits}
          onEdit={() => {
            setCreated(false);
            setStep(2);
          }}
          onDelete={handleDelete}
        />
      </div>
    );
  }

  const education = draft.education[0];

  const educationEditor = (
    <div className="grid gap-3 sm:grid-cols-2">
      <F id="rev-degree-level" label="Degree level">
        <select
          id="rev-degree-level"
          value={education?.degreeLevel ?? ""}
          onChange={(event) =>
            updateEducation({ degreeLevel: (event.target.value || null) as DegreeLevel | null })
          }
        >
          <option value="">Choose…</option>
          {(Object.keys(DEGREE_LABELS) as DegreeLevel[]).map((level) => (
            <option key={level} value={level}>
              {DEGREE_LABELS[level]}
            </option>
          ))}
        </select>
      </F>
      <F id="rev-degree" label="Degree name">
        <input
          id="rev-degree"
          value={education?.degreeName ?? ""}
          onChange={(event) => updateEducation({ degreeName: event.target.value })}
        />
      </F>
      <F id="rev-school" label="School">
        <input
          id="rev-school"
          value={education?.school ?? ""}
          onChange={(event) => updateEducation({ school: event.target.value })}
        />
      </F>
      <F id="rev-field" label="Field of study">
        <input
          id="rev-field"
          value={education?.field ?? ""}
          onChange={(event) => updateEducation({ field: event.target.value })}
        />
      </F>
      <F id="rev-gpa" label="GPA value">
        <input
          id="rev-gpa"
          value={draft.gpaValue}
          onChange={(event) => manual("gpaValue", { ...draft, gpaValue: event.target.value })}
        />
      </F>
      <F id="rev-gpa-scale" label="GPA scale">
        <input
          id="rev-gpa-scale"
          value={draft.gpaScale}
          onChange={(event) => manual("gpaScale", { ...draft, gpaScale: event.target.value })}
        />
      </F>
    </div>
  );

  const detailsEditor = (
    <div className="grid gap-3 sm:grid-cols-2">
      <F id="rev-name" label="Full name">
        <input
          id="rev-name"
          value={draft.fullName}
          onChange={(event) => manual("fullName", { ...draft, fullName: event.target.value })}
        />
      </F>
      <F id="rev-grad" label="Graduation date">
        <input
          id="rev-grad"
          value={draft.graduationDate ?? ""}
          placeholder="e.g. 2027-06"
          onChange={(event) =>
            manual("graduationDate", {
              ...draft,
              graduationDate: event.target.value || null,
              graduationDatePrecision: draft.graduationDatePrecision ?? "month",
            })
          }
        />
      </F>
    </div>
  );

  const skillsEditor = (
    <div className="grid gap-4">
      <MultiSelect
        id="rev-skills"
        label="Skills"
        options={SKILL_OPTIONS}
        values={draft.skills}
        onChange={(skills) => manual("skills", { ...draft, skills })}
      />
      <div className="grid gap-2">
        <p className="text-sm font-semibold">Languages</p>
        {draft.languageDetails.map((lang, index) => (
          <div key={`${lang.name}-${index}`} className="flex items-end gap-2">
            <F id={`lang-name-${index}`} label="Language" className="flex-1">
              <input
                id={`lang-name-${index}`}
                list="rev-language-options"
                value={lang.name}
                onChange={(event) =>
                  manual("languages", {
                    ...draft,
                    languages: draft.languages.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                    languageDetails: draft.languageDetails.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, name: event.target.value } : item,
                    ),
                  })
                }
              />
            </F>
            <F id={`lang-level-${index}`} label="Level">
              <input
                id={`lang-level-${index}`}
                value={lang.level}
                onChange={(event) =>
                  manual("languages", {
                    ...draft,
                    languageDetails: draft.languageDetails.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, level: event.target.value } : item,
                    ),
                  })
                }
              />
            </F>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                manual("languages", {
                  ...draft,
                  languages: draft.languages.filter((_, itemIndex) => itemIndex !== index),
                  languageDetails: draft.languageDetails.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <datalist id="rev-language-options">
          {LANGUAGE_OPTIONS.map((language) => (
            <option key={language} value={language} />
          ))}
        </datalist>
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              manual("languages", {
                ...draft,
                languages: [...draft.languages, ""],
                languageDetails: [...draft.languageDetails, { name: "", level: "Intermediate" }],
              })
            }
          >
            Add language
          </Button>
        </div>
      </div>
    </div>
  );

  const preferencesEditor = (
    <div className="grid gap-4">
      <MultiSelect
        id="rev-locations"
        label="Preferred locations"
        options={LOCATION_OPTIONS}
        values={draft.preferences.locations}
        onChange={(locations) =>
          manual("preferences.locations", {
            ...draft,
            preferences: { ...draft.preferences, locations },
          })
        }
      />
      <label className="flex min-h-[44px] items-center gap-2 font-normal">
        <input
          type="checkbox"
          className="w-auto"
          checked={draft.preferences.remoteOk}
          onChange={(event) =>
            manual("preferences.remoteOk", {
              ...draft,
              preferences: { ...draft.preferences, remoteOk: event.target.checked },
            })
          }
        />
        I'm open to remote opportunities
      </label>
    </div>
  );

  const goalsEditor = (
    <F id="rev-goals" label="Goals">
      <textarea
        id="rev-goals"
        rows={4}
        value={draft.goals}
        onChange={(event) => manual("goals", { ...draft, goals: event.target.value })}
      />
    </F>
  );

  const emailOk = Boolean(normalizeEmail(draft.email)) || draft.emailTrackingOptOut === true;
  const emailGate = (
    <div className="grid gap-3">
      <F id="rev-email" label="Email (used for your Tracker inbox)">
        <input
          id="rev-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(draft.email?.trim()) && !normalizeEmail(draft.email)}
          value={draft.email ?? ""}
          placeholder={draft.email ? undefined : "Not in your documents — type it here"}
          onChange={(event) => manual("email", { ...draft, email: event.target.value })}
        />
      </F>
      {Boolean(draft.email?.trim()) && !normalizeEmail(draft.email) && (
        <p className="text-sm text-destructive" role="alert">
          That email doesn't look right — it should look like name@example.com, with no spaces.
          Fix it, or tick the box below to continue without one.
        </p>
      )}
      <label className="flex items-start gap-2 text-sm" htmlFor="rev-email-optout">
        <input
          id="rev-email-optout"
          type="checkbox"
          className="mt-1 shrink-0"
          checked={draft.emailTrackingOptOut ?? false}
          onChange={(event) =>
            persistDraft({ ...draft, emailTrackingOptOut: event.target.checked })
          }
        />
        <span className="min-w-0 flex-1">
          I don't need my email tracked and won't connect my inbox. You can make your profile
          without an email.
        </span>
      </label>
      {!emailOk && (
        <p className="text-sm text-destructive" role="alert">
          {draft.email?.trim()
            ? "That email doesn't look right. Fix it, or tick the box to continue."
            : "Email missing. Add your email, or tick the box to continue."}
        </p>
      )}
    </div>
  );

  const canContinue = step === 1 ? !extracting : step === 2 ? emailOk : step < 4;

  return (
    <div className="mx-auto max-w-[760px] pb-24">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Opportunity Passport</p>
          <h1 className="text-3xl">Build your profile</h1>
          <p className="mt-1 text-muted-foreground">
            Five short steps. Everything is saved privately in this browser as you go.
          </p>
        </div>
        {!profile?.confirmed && (
          <Button
            variant="outline"
            onClick={() => {
              loadDemoProfile();
              stampSaved();
            }}
          >
            <Sparkles /> Load demo profile
          </Button>
        )}
      </header>

      {deletedNotice && (
        <p role="status" className="mt-4 border border-border bg-card p-3 text-sm">
          Your Passport was deleted. Saved opportunities and applications are unchanged.
        </p>
      )}

      <ol className="mt-6 flex flex-wrap gap-2" aria-label="Profile steps">
        {STEPS.map((label, index) => (
          <li key={label}>
            <Button
              type="button"
              variant="ghost"
              aria-current={index === step ? "step" : undefined}
              disabled={extracting || webBusy}
              onClick={() => setStep(index)}
              className={`profile-step h-auto min-h-[44px] justify-start border-x-0 border-b-0 px-1 pb-2 font-sans normal-case ${index === step ? "profile-step-active" : ""} ${
                index < step ? "opacity-80" : ""
              }`}
            >
              <span className="font-semibold">{index + 1}.</span> {label}
            </Button>
          </li>
        ))}
      </ol>

      <main className="mt-6">
        {step === 0 && (
          <StepUpload
            documents={documents}
            setDocuments={setDocuments}
            message={message}
            setMessage={setMessage}
            webBusy={webBusy}
            webError={webError}
            onReadWebLink={readWebLink}
          />
        )}
        {step === 1 && (
          <StepExtract
            running={extracting}
            results={results}
            draft={draft}
            onContinue={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepReview
            draft={draft}
            conflicts={conflicts}
            choices={choices}
            onChooseConflict={chooseConflict}
            educationEditor={educationEditor}
            detailsEditor={detailsEditor}
            emailGate={emailGate}
            skillsEditor={skillsEditor}
            preferencesEditor={preferencesEditor}
            experienceEditor={<ExperienceEditor profile={draft} onChange={persistDraft} />}
            onDraftChange={persistDraft}
            goalsEditor={goalsEditor}
          />
        )}
        {step === 3 && (
          <StepGaps
            draft={draft}
            manual={manual}
            updateEducation={updateEducation}
            experienceEditor={<ExperienceEditor profile={draft} onChange={persistDraft} />}
          />
        )}
        {step === 4 && (
          <StepConfirm
            draft={draft}
            saving={saving}
            emailOk={emailOk}
            emailGate={emailGate}
            onEditStep={(target) => setStep(target)}
            onCreate={confirm}
            onSaveLater={() => persistDraft(draft)}
          />
        )}
      </main>

      {message && step !== 0 && (
        <p role="alert" className="field-error mt-4">
          {message}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-3 px-4 py-3">
          <div>
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={extracting}>
                <ArrowLeft /> Back
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            {savedAt ? `Saved ${savedAt}` : "Changes save automatically"}
          </p>
          <div className="flex items-center gap-2">
            {step === 0 && !hasSource && (
              <Button variant="ghost" onClick={() => setStep(2)}>
                Enter details myself
              </Button>
            )}
            {step === 0 && (
              <Button disabled={!hasSource} onClick={runExtraction}>
                Extract details <ArrowRight />
              </Button>
            )}
            {step > 0 && step < 4 && (step === 1 ? canContinue : true) && (
              <Button disabled={!canContinue} onClick={() => setStep(step + 1)}>
                Continue <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
