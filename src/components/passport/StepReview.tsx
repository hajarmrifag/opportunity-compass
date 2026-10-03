import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Profile, ProfileValueSource } from "@/domain/types";
import { DEGREE_LABELS, WORK_TYPE_LABELS } from "@/domain/types";
import {
  acceptExperience,
  dismissExperience,
  fieldLabel,
  type ExtractionConflict,
} from "@/lib/profileExtraction";

/** Small provenance label: extracted vs added by you. */
export function SourceTag({ source }: { source: ProfileValueSource | undefined }) {
  if (!source) return null;
  return (
    <span className="chip chip-muted">
      {source === "extracted" ? "From your document" : "Added by you"}
    </span>
  );
}

export function NotProvided() {
  return <span className="text-sm italic text-muted-foreground">Not provided</span>;
}

function ReviewCard({
  title,
  editing,
  onToggle,
  summary,
  editor,
}: {
  title: string;
  editing: boolean;
  onToggle: () => void;
  summary: ReactNode;
  editor: ReactNode;
}) {
  return (
    <section className="border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Button size="sm" variant="outline" aria-expanded={editing} onClick={onToggle}>
          <Pencil /> {editing ? "Done" : "Edit"}
        </Button>
      </div>
      <div className="mt-3">{editing ? editor : summary}</div>
    </section>
  );
}

function Row({
  label,
  source,
  children,
}: {
  label: string;
  source?: ProfileValueSource | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1">
      <span className="w-40 shrink-0 text-sm font-semibold text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <SourceTag source={source} />
    </div>
  );
}

export function StepReview({
  draft,
  conflicts,
  choices,
  onChooseConflict,
  educationEditor,
  detailsEditor,
  emailGate,
  skillsEditor,
  preferencesEditor,
  experienceEditor,
  goalsEditor,
  onDraftChange,
}: {
  draft: Profile;
  conflicts: ExtractionConflict[];
  choices: Record<string, string>;
  onChooseConflict: (field: string, value: string) => void;
  educationEditor: ReactNode;
  detailsEditor: ReactNode;
  emailGate: ReactNode;
  skillsEditor: ReactNode;
  preferencesEditor: ReactNode;
  experienceEditor: ReactNode;
  goalsEditor: ReactNode;
  onDraftChange: (next: Profile) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (key: string) => setOpen((current) => (current === key ? null : key));
  const education = draft.education[0];
  const provenance = draft.fieldProvenance;
  const suggestions = draft.experienceSuggestions ?? [];

  return (
    <div>
      <p className="eyebrow">Step 3 of 5</p>
      <h2 className="mt-1 text-2xl">Review what we found</h2>
      <p className="mt-1 text-muted-foreground">
        Check each section. Anything missing is marked “Not provided” — you can add it here or in
        the next step. You can change all of this later.
      </p>

      {conflicts.length > 0 && (
        <section className="mt-5 border border-warning bg-warning-soft p-5" aria-live="polite">
          <h3 className="font-semibold">We found different values</h3>
          <p className="text-sm text-muted-foreground">
            Your documents disagree on these. Choose which value to keep.
          </p>
          <ul className="mt-3 grid gap-4">
            {conflicts.map((conflict) => (
              <li key={conflict.field}>
                <p className="font-semibold">{fieldLabel(conflict.field)}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {[...new Set(conflict.candidates.map((item) => item.value))].map((value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={choices[conflict.field] === value ? "default" : "outline"}
                      aria-pressed={choices[conflict.field] === value}
                      onClick={() => onChooseConflict(conflict.field, value)}
                    >
                      {value}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant={choices[conflict.field] === "" ? "default" : "ghost"}
                    aria-pressed={choices[conflict.field] === ""}
                    onClick={() => onChooseConflict(conflict.field, "")}
                  >
                    Leave empty
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-5 grid gap-4">
        <ReviewCard
          title="Education"
          editing={open === "education"}
          onToggle={() => toggle("education")}
          summary={
            <div className="divide-y divide-border">
              <Row label="Degree level" source={provenance["degreeLevel"]}>
                {education?.degreeLevel ? DEGREE_LABELS[education.degreeLevel] : <NotProvided />}
              </Row>
              <Row label="Degree" source={provenance["degreeName"]}>
                {education?.degreeName || <NotProvided />}
              </Row>
              <Row label="School" source={provenance["school"]}>
                {education?.school || <NotProvided />}
              </Row>
              <Row label="Field of study" source={provenance["field"]}>
                {education?.field || <NotProvided />}
              </Row>
              <Row label="GPA" source={provenance["gpaValue"]}>
                {draft.gpaValue.trim()
                  ? `${draft.gpaValue}${draft.gpaScale.trim() ? ` / ${draft.gpaScale}` : ""}`
                  : "Not provided"}
              </Row>
            </div>
          }
          editor={educationEditor}
        />

        <ReviewCard
          title="Personal details"
          editing={open === "details"}
          onToggle={() => toggle("details")}
          summary={
            <div className="divide-y divide-border">
              <Row label="Name" source={provenance["fullName"]}>
                {draft.fullName || <NotProvided />}
              </Row>
              <Row label="Graduation" source={provenance["graduationDate"]}>
                {draft.graduationDate || <NotProvided />}
              </Row>
              <Row label="Email" source={provenance["email"]}>
                {draft.email || <NotProvided />}
              </Row>
              {emailGate}
            </div>
          }
          editor={
            <>
              {detailsEditor}
              {emailGate}
            </>
          }
        />

        <ReviewCard
          title="Skills and languages"
          editing={open === "skills"}
          onToggle={() => toggle("skills")}
          summary={
            <div className="divide-y divide-border">
              <Row label="Skills" source={provenance["skill"]}>
                {draft.skills.length ? draft.skills.join(", ") : <NotProvided />}
              </Row>
              <Row label="Languages" source={provenance["language"]}>
                {draft.languageDetails.length
                  ? draft.languageDetails
                      .map((lang) => (lang.level ? `${lang.name} (${lang.level})` : lang.name))
                      .join(", ")
                  : "Not provided"}
              </Row>
            </div>
          }
          editor={skillsEditor}
        />

        <ReviewCard
          title="Preferences"
          editing={open === "preferences"}
          onToggle={() => toggle("preferences")}
          summary={
            <div className="divide-y divide-border">
              <Row label="Opportunity types" source={provenance["preferences.categories"]}>
                {draft.preferences.categories.length
                  ? draft.preferences.categories.join(", ")
                  : "Not provided"}
              </Row>
              <Row label="Locations" source={provenance["preferences.locations"]}>
                {draft.preferences.locations.length
                  ? draft.preferences.locations.join(", ")
                  : "Not provided"}
              </Row>
              <Row label="Remote" source={provenance["preferences.remoteOk"]}>
                {draft.preferences.remoteOk ? "Open to remote" : "Not stated"}
              </Row>
            </div>
          }
          editor={preferencesEditor}
        />

        <ReviewCard
          title="Experience"
          editing={open === "experience"}
          onToggle={() => toggle("experience")}
          summary={
            draft.workExperience.length || suggestions.length ? (
              <div className="grid gap-4">
                {suggestions.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      We found {suggestions.length} role{suggestions.length === 1 ? "" : "s"} in
                      your documents. Add the ones that are yours.
                    </p>
                    <ul className="mt-2 grid gap-2">
                      {suggestions.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex flex-wrap items-start justify-between gap-3 border border-dashed border-border p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{entry.role || "Untitled role"}</p>
                            <p className="text-sm text-muted-foreground">
                              {entry.organization}
                              {entry.type ? ` · ${WORK_TYPE_LABELS[entry.type]}` : ""}
                              {entry.location ? ` · ${entry.location}` : ""}
                            </p>
                            {entry.description && (
                              <p className="mt-1 text-sm">{entry.description}</p>
                            )}
                            <span className="chip chip-muted mt-2 inline-block">
                              From {entry.sourceFile || "your document"}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => onDraftChange(acceptExperience(draft, entry.id))}
                            >
                              Add
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDraftChange(dismissExperience(draft, entry.id))}
                            >
                              Not mine
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {suggestions.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() =>
                          onDraftChange(
                            suggestions.reduce(
                              (profile, entry) => acceptExperience(profile, entry.id),
                              draft,
                            ),
                          )
                        }
                      >
                        Add all {suggestions.length}
                      </Button>
                    )}
                  </div>
                )}
                {draft.workExperience.length > 0 && (
                  <ul className="grid gap-2">
                    {draft.workExperience.map((entry) => (
                      <li key={entry.id} className="border border-border p-3">
                        <p className="font-semibold">{entry.role}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.organization}
                          {entry.type ? ` · ${WORK_TYPE_LABELS[entry.type]}` : ""}
                          {entry.location ? ` · ${entry.location}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <NotProvided />
            )
          }
          editor={experienceEditor}
        />

        <ReviewCard
          title="Goals"
          editing={open === "goals"}
          onToggle={() => toggle("goals")}
          summary={
            <Row label="Your goals" source={provenance["goals"]}>
              {draft.goals.trim() || <NotProvided />}
            </Row>
          }
          editor={goalsEditor}
        />
      </div>
    </div>
  );
}
