import type { ReactNode } from "react";
import { CircleCheck, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/domain/types";
import { CATEGORY_LABELS, DEGREE_LABELS, WORK_TYPE_LABELS } from "@/domain/types";

function PreviewRow({
  label,
  children,
  onEdit,
}: {
  label: string;
  children: ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border py-3 last:border-0">
      <span className="w-44 shrink-0 text-sm font-semibold text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <button
        type="button"
        className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary"
        onClick={onEdit}
      >
        <Pencil className="size-3.5" /> Edit
      </button>
    </div>
  );
}

const Empty = () => <span className="italic text-muted-foreground">Not provided</span>;

export function StepConfirm({
  draft,
  saving,
  onEditStep,
  onCreate,
  onSaveLater,
}: {
  draft: Profile;
  saving: boolean;
  onEditStep: (step: number) => void;
  onCreate: () => void;
  onSaveLater: () => void;
}) {
  const education = draft.education[0];
  return (
    <div>
      <p className="eyebrow">Step 5 of 5</p>
      <h2 className="mt-1 text-2xl">Your Opportunity Passport</h2>
      <p className="mt-1 text-muted-foreground">
        This is the profile we'll use to match you with opportunities. Check it over — you can
        change any of it later.
      </p>

      <div className="mt-5 border border-border bg-card p-5">
        <PreviewRow label="Name" onEdit={() => onEditStep(2)}>
          {draft.fullName || <Empty />}
        </PreviewRow>
        <PreviewRow label="Education" onEdit={() => onEditStep(3)}>
          {education && (education.degreeName || education.school || education.field) ? (
            <>
              {[
                education.degreeLevel ? DEGREE_LABELS[education.degreeLevel] : "",
                education.degreeName,
              ]
                .filter(Boolean)
                .join(" — ")}
              {education.school ? `, ${education.school}` : ""}
              {education.field ? ` (${education.field})` : ""}
            </>
          ) : (
            <Empty />
          )}
        </PreviewRow>
        <PreviewRow label="GPA" onEdit={() => onEditStep(2)}>
          {draft.gpaValue.trim()
            ? `${draft.gpaValue}${draft.gpaScale.trim() ? ` / ${draft.gpaScale}` : ""}`
            : "Not provided"}
        </PreviewRow>
        <PreviewRow label="Graduation" onEdit={() => onEditStep(3)}>
          {draft.graduationDate || <Empty />}
        </PreviewRow>
        <PreviewRow label="Skills" onEdit={() => onEditStep(3)}>
          {draft.skills.length ? draft.skills.join(", ") : <Empty />}
        </PreviewRow>
        <PreviewRow label="Languages" onEdit={() => onEditStep(3)}>
          {draft.languageDetails.length
            ? draft.languageDetails
                .map((lang) => (lang.level ? `${lang.name} (${lang.level})` : lang.name))
                .join(", ")
            : "Not provided"}
        </PreviewRow>
        <PreviewRow label="Opportunity types" onEdit={() => onEditStep(3)}>
          {draft.preferences.categories.length
            ? draft.preferences.categories.map((cat) => CATEGORY_LABELS[cat]).join(", ")
            : "Not provided"}
        </PreviewRow>
        <PreviewRow label="Location" onEdit={() => onEditStep(3)}>
          {draft.preferences.remoteOk
            ? "Open to remote"
            : draft.preferences.locations.length
              ? draft.preferences.locations.join(", ")
              : "Not provided"}
        </PreviewRow>
        <PreviewRow label="Funding needs" onEdit={() => onEditStep(3)}>
          {[
            draft.fundingNeeds.tuition && "tuition",
            draft.fundingNeeds.living && "living costs",
            draft.fundingNeeds.travel && "travel",
          ]
            .filter(Boolean)
            .join(", ") || "None stated"}
        </PreviewRow>
        <PreviewRow label="Experience" onEdit={() => onEditStep(3)}>
          {draft.workExperience.length ? (
            <ul className="grid gap-1">
              {draft.workExperience.map((entry) => (
                <li key={entry.id}>
                  {entry.role} — {entry.organization}
                  {entry.type ? ` (${WORK_TYPE_LABELS[entry.type]})` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </PreviewRow>
        <PreviewRow label="Goals" onEdit={() => onEditStep(3)}>
          {draft.goals.trim() || <Empty />}
        </PreviewRow>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button size="lg" disabled={saving} onClick={onCreate}>
          {saving ? "Creating your profile…" : "Create my profile"}
        </Button>
        <Button size="lg" variant="outline" disabled={saving} onClick={onSaveLater}>
          Save and finish later
        </Button>
      </div>
    </div>
  );
}

export function ProfileCreated({ name }: { name: string }) {
  return (
    <div className="border border-border bg-card p-8 text-center" role="status">
      <CircleCheck className="mx-auto size-12 text-primary" aria-hidden="true" />
      <h2 className="mt-4 text-2xl">
        Your profile is ready{name ? `, ${name.split(" ")[0]}` : ""}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">
        Your Opportunity Passport is saved in this browser. Discover and Live search now use it to
        explain why each opportunity fits you — relevance only, never a promise of eligibility.
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        You can come back to this page any time to update it.
      </p>
    </div>
  );
}
