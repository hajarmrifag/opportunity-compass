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
import { F, MultiSelect } from "@/components/passport/fields";
import { fileBase64, uid, type IntakeDocument } from "@/components/passport/shared";
import {
  LANGUAGE_OPTIONS,
  LOCATION_OPTIONS,
  SKILL_OPTIONS,
} from "@/lib/curatedOptions";
import { EMPTY_PROFILE } from "@/data/fixtures";
import type {
  ConflictChoice,
  DocumentExtractionResult,
  EducationEntry,
  Profile,
} from "@/domain/types";
import { extractProfile, extractWebProfile } from "@/lib/profileExtraction.functions";
import {
  applyExtractedCandidates,
  canConfirmProfile,
  extractionConflicts,
  fieldLabel,
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
      { title: "Opportunity Passport — OpportunityOS" },
      {
        name: "description",
        content:
          "Build your student profile step by step: upload documents, review what we find, fill the gaps, and confirm. Saved privately in your browser.",
      },
      { property: "og:title", content: "Opportunity Passport — OpportunityOS" },
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
  } = useStore();
  const runExtractionFn = useServerFn(extractProfile);
  const runWebExtraction = useServerFn(extractWebProfile);

  const [step, setStep] = useState(0);
  const [created, setCreated] = useState(false);
  const [documents, setDocuments] = useState<IntakeDocument[]>([]);
  const [results, setResults] = useState<DocumentExtractionResult[]>([]);
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({});
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

  /** Every draft change persists as the review draft (confirmed stays false until step 5). */
  const persistDraft = (next: Profile) => {
    setProfileDraft({ ...next, confirmed: false, confirmedAt: null });
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
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
      gpaValue: null,
      gpaScale: null,
    };
    const next: Profile = {
      ...draft,
      education: [{ ...education, ...patch }, ...draft.education.slice(1)],
    };
    for (const key of Object.keys(patch)) manual(`education.${key}`, next);
    if (!Object.keys(patch).length) persistDraft(next);
  };

  const readWebLink = async (normalizedUrl: string) => {
    setWebBusy(true);
    setWebError("");
    try {
      const result = await runWebExtraction({ data: { url: normalizedUrl, consent: true } });
      if (result.error) return setWebError(result.error);
      setResults((current) => [...current, result]);
      const conflicts = extractionConflicts(draft, [result]);
      setChoices((current) => {
        const next = { ...current };
        for (const conflict of conflicts) if (!(conflict.key in next)) next[conflict.key] = "";
        return next;
      });
      persistDraft(applyExtractedCandidates(draft, [result], choices));
    } catch {
      setWebError("We couldn't read that link. Check the address and try again.");
    } finally {
      setWebBusy(false);
    }
  };

  const runExtraction = async () => {
    const readyDocuments = documents.filter((document) => document.state === "ready");
    if (!readyDocuments.length) return;
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
                mime: "application/pdf" as const,
                dataBase64: await fileBase64(document.file),
              }
            : { name: document.name, label: document.label, text: document.text ?? "" };
        const result = await runExtractionFn({ data: input });
        all.push(result);
        setDocuments((current) =>
          current.map((item) =>
            item.id === document.id
              ? { ...item, state: result.error ? "error" : "done", error: result.error }
              : item,
          ),
        );
      } catch {
        all.push({ name: document.name, source: document.label, candidates: [], error: "extraction failed" });
        setDocuments((current) =>
          current.map((item) =>
            item.id === document.id
              ? { ...item, state: "error", error: "extraction failed" }
              : item,
          ),
        );
      }
    }
    setResults((current) => [...current, ...all]);
    const conflicts = extractionConflicts(draft, all);
    const nextChoices = { ...choices };
    for (const conflict of conflicts)
      if (!(conflict.key in nextChoices)) nextChoices[conflict.key] = "";
    setChoices(nextChoices);
    persistDraft(applyExtractedCandidates(draft, all, nextChoices));
    setExtracting(false);
  };

  const chooseConflict = (key: string, choice: ConflictChoice) => {
    const nextChoices = { ...choices, [key]: choice };
    setChoices(nextChoices);
    persistDraft(applyExtractedCandidates(EMPTY_PROFILE, results, nextChoices));
  };

  const conflicts = useMemo(() => extractionConflicts(draft, results), [draft, results]);

  const confirm = () => {
    if (!canConfirmProfile(draft, conflicts, choices).ok)
      return setMessage("Resolve the conflicting values first.");
    setSaving(true);
    saveProfile({ ...draft, confirmed: true, confirmedAt: new Date().toISOString() });
    setSaving(false);
    setCreated(true);
  };

  const hasSource = documents.some((document) => document.state !== "error");

  if (!ready) return null;

  if (created) {
    return (
      <div className="mx-auto max-w-[760px]">
        <ProfileCreated name={draft.fullName} />
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="outline" onClick={() => setCreated(false)}>
            Edit my profile
          </Button>
        </div>
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
          onChange={(event) => updateEducation({ degreeLevel: event.target.value || null })}
        >
          <option value="">Choose…</option>
          {["High school", "Bachelor's", "Master's", "PhD", "Other"].map((level) => (
            <option key={level} value={level}>
              {level}
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
      <F id="rev-gpa" label="GPA">
        <input
          id="rev-gpa"
          type="number"
          step="0.01"
          value={education?.gpaValue ?? ""}
          onChange={(event) =>
            updateEducation({
              gpaValue: event.target.value === "" ? null : Number(event.target.value),
            })
          }
        />
      </F>
      <F id="rev-gpa-scale" label="GPA scale">
        <input
          id="rev-gpa-scale"
          type="number"
          step="0.1"
          value={education?.gpaScale ?? ""}
          onChange={(event) =>
            updateEducation({
              gpaScale: event.target.value === "" ? null : Number(event.target.value),
            })
          }
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
      <F id="rev-nationality" label="Nationality">
        <input
          id="rev-nationality"
          value={draft.nationality}
          onChange={(event) => manual("nationality", { ...draft, nationality: event.target.value })}
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
        {draft.languages.map((lang, index) => (
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
                    languages: draft.languages.map((item, itemIndex) =>
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
                languages: [...draft.languages, { name: "", level: "Intermediate" }],
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

  const canContinue =
    step === 0
      ? true
      : step === 1
        ? !extracting
        : step === 4
          ? false
          : true;

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
              setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
            }}
          >
            <Sparkles /> Load demo profile
          </Button>
        )}
      </header>

      <ol className="mt-6 flex flex-wrap gap-2" aria-label="Profile steps">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={`profile-step ${index === step ? "profile-step-active" : ""} ${
              index < step ? "opacity-80" : ""
            }`}
          >
            <span className="font-semibold">{index + 1}.</span> {label}
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
            skillsEditor={skillsEditor}
            preferencesEditor={preferencesEditor}
            experienceEditor={
              <ExperienceEditor profile={draft} onChange={persistDraft} />
            }
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
            {step > 0 && step < 4 && canContinue && (
              <Button onClick={() => setStep(step + 1)}>
                Continue <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
