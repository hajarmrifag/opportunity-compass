import { useEffect, useMemo, useState } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import type { DocumentExtractionResult, Profile } from "@/domain/types";

const STAGE_MESSAGES = [
  "Reading your documents…",
  "Identifying education…",
  "Finding skills and experience…",
  "Preparing your profile…",
];

export function ExtractionProgress({ running }: { running: boolean }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!running) return;
    setStage(0);
    const timer = setInterval(() => setStage((value) => (value + 1) % STAGE_MESSAGES.length), 1600);
    return () => clearInterval(timer);
  }, [running]);
  return (
    <div className="mt-6 border border-border bg-card p-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <p className="text-lg font-semibold">{STAGE_MESSAGES[stage]}</p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        This usually takes a few seconds per document. You can leave this page — your draft is
        saved.
      </p>
    </div>
  );
}

/** Summary of what extraction found, shown after all documents finish. */
export function ExtractionSummary({
  results,
  draft,
  onContinue,
}: {
  results: DocumentExtractionResult[];
  draft: Profile;
  onContinue: () => void;
}) {
  const found = useMemo(() => {
    const education = draft.education.filter(
      (entry) => entry.degreeName || entry.school || entry.field,
    );
    const experience =
      draft.workExperience.length + (draft.experienceSuggestions?.length ?? 0);
    const skills = draft.skills.length;
    const languages = draft.languages.length;
    const missing: string[] = [];
    if (!education.length) missing.push("education");
    if (!skills) missing.push("skills");
    if (!languages) missing.push("languages");
    if (!draft.goals.trim()) missing.push("goals");
    return { education: education.length, experience, skills, languages, missing };
  }, [draft]);

  const errors = results.filter((result) => result.error);

  return (
    <div className="mt-6 border border-border bg-card p-6">
      <h3 className="text-lg font-semibold">Here's what we found</h3>
      <ul className="mt-3 grid gap-2">
        <li className="flex items-center gap-2">
          <CircleCheck className="size-4 text-primary" aria-hidden="true" />
          {found.education
            ? `${found.education} education record${found.education === 1 ? "" : "s"}`
            : "No education record found yet"}
        </li>
        <li className="flex items-center gap-2">
          <CircleCheck className="size-4 text-primary" aria-hidden="true" />
          {found.skills ? `${found.skills} skills` : "No skills found yet"}
        </li>
        <li className="flex items-center gap-2">
          <CircleCheck className="size-4 text-primary" aria-hidden="true" />
          {found.languages ? `${found.languages} languages` : "No languages found yet"}
        </li>
        <li className="flex items-center gap-2">
          <CircleCheck className="size-4 text-primary" aria-hidden="true" />
          {found.experience
            ? `${found.experience} experience role${found.experience === 1 ? "" : "s"} (work, research or volunteer)`
            : "No experience found yet"}
        </li>
      </ul>
      {found.missing.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Missing so far: {found.missing.join(", ")} — you can add these in the next steps.
        </p>
      )}
      {errors.length > 0 && (
        <p role="alert" className="mt-3 text-sm text-warning-strong">
          {errors.length} document{errors.length === 1 ? "" : "s"} could not be read. You can add
          the details yourself in the next steps.
        </p>
      )}
      <button
        type="button"
        className="mt-4 min-h-[44px] font-semibold text-primary underline"
        onClick={onContinue}
      >
        Continue to review
      </button>
    </div>
  );
}

export function StepExtract({
  running,
  results,
  draft,
  onContinue,
}: {
  running: boolean;
  results: DocumentExtractionResult[];
  draft: Profile;
  onContinue: () => void;
}) {
  return (
    <div>
      <p className="eyebrow">Step 2 of 5</p>
      <h2 className="mt-1 text-2xl">Extracting your details</h2>
      <p className="mt-1 text-muted-foreground">
        We read your documents once, privately, and pull out education, skills, languages and
        experience. Nothing is saved to your profile until you confirm it.
      </p>
      {running && <ExtractionProgress running={running} />}
      {!running && results.length > 0 && (
        <ExtractionSummary results={results} draft={draft} onContinue={onContinue} />
      )}
      {!running && results.length === 0 && (
        <p className="mt-6 border border-border bg-card p-6 text-muted-foreground">
          No documents to read yet. Go back and add a document, or continue and enter your details
          yourself.
        </p>
      )}
    </div>
  );
}
