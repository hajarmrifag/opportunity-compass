import { useMemo, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Category, GraduationDatePrecision, Profile } from "@/domain/types";
import { CATEGORY_LABELS, DEGREE_LABELS, type DegreeLevel } from "@/domain/types";
import {
  FIELD_OPTIONS,
  LANGUAGE_LEVELS,
  LANGUAGE_OPTIONS,
  LOCATION_OPTIONS,
  SKILL_OPTIONS,
} from "@/lib/curatedOptions";
import { ChipRow, F, MultiSelect } from "./fields";
import { uid } from "./shared";

const CATEGORIES: Category[] = [
  "masters",
  "research",
  "fellowship",
  "scholarship",
  "internship",
  "exchange",
];

function Why({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Question({ title, why, children }: { title: string; why: string; children: ReactNode }) {
  return (
    <section className="border border-border bg-card p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <Why>{why}</Why>
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

/** Structured graduation date control: precision + year (+ month/day when known). */
function GraduationControl({
  value,
  precision,
  onChange,
}: {
  value: string | null;
  precision: GraduationDatePrecision | null;
  onChange: (date: string | null, precision: GraduationDatePrecision | null) => void;
}) {
  const now = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, index) => String(now - 1 + index));
  const [yearPart, monthPart, dayPart] = (value ?? "").split("-");
  const mode = precision ?? "unknown";

  const build = (year: string, month: string, day: string, nextMode: string) => {
    if (!year)
      return onChange(null, nextMode === "unknown" ? null : (nextMode as GraduationDatePrecision));
    if (nextMode === "year") return onChange(year, "year");
    if (nextMode === "month") return onChange(month ? `${year}-${month}` : year, "month");
    if (nextMode === "day")
      return onChange(
        month && day ? `${year}-${month}-${day}` : month ? `${year}-${month}` : year,
        "day",
      );
    onChange(year, "year");
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <F id="grad-precision" label="How much do you know?">
        <select
          id="grad-precision"
          value={mode}
          onChange={(event) =>
            build(yearPart ?? "", monthPart ?? "", dayPart ?? "", event.target.value)
          }
        >
          <option value="unknown">Not sure yet</option>
          <option value="year">Just the year</option>
          <option value="month">Month and year</option>
          <option value="day">Exact date</option>
        </select>
      </F>
      {mode !== "unknown" && (
        <F id="grad-year" label="Year">
          <select
            id="grad-year"
            value={yearPart ?? ""}
            onChange={(event) => build(event.target.value, monthPart ?? "", dayPart ?? "", mode)}
          >
            <option value="">Choose a year</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </F>
      )}
      {(mode === "month" || mode === "day") && (
        <F id="grad-month" label="Month">
          <select
            id="grad-month"
            value={monthPart ?? ""}
            onChange={(event) => build(yearPart ?? "", event.target.value, dayPart ?? "", mode)}
          >
            <option value="">Choose a month</option>
            {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map(
              (month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ),
            )}
          </select>
        </F>
      )}
      {mode === "day" && (
        <F id="grad-day" label="Day">
          <select
            id="grad-day"
            value={dayPart ?? ""}
            onChange={(event) => build(yearPart ?? "", monthPart ?? "", event.target.value, mode)}
          >
            <option value="">Choose a day</option>
            {Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0")).map(
              (day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ),
            )}
          </select>
        </F>
      )}
    </div>
  );
}

export function StepGaps({
  draft,
  manual,
  updateEducation,
  experienceEditor,
}: {
  draft: Profile;
  manual: (field: string, next: Profile) => void;
  updateEducation: (patch: Partial<Profile["education"][number]>) => void;
  experienceEditor: ReactNode;
}) {
  const [langName, setLangName] = useState("");
  const [langLevel, setLangLevel] = useState<string>(LANGUAGE_LEVELS[3]);
  const [addingEducation, setAddingEducation] = useState(false);
  const [newDegree, setNewDegree] = useState("");
  const [newSchool, setNewSchool] = useState("");

  const missingEducation = !draft.education.some(
    (entry) => entry.degreeName || entry.school || entry.field,
  );
  const wantsMasters = draft.preferences.categories.includes("masters");
  const fundingAny =
    draft.fundingNeeds.tuition || draft.fundingNeeds.living || draft.fundingNeeds.travel;

  const showEducation = missingEducation || addingEducation || true; // always editable here

  const nothingMissing = useMemo(
    () =>
      !missingEducation &&
      draft.skills.length > 0 &&
      draft.languages.length > 0 &&
      draft.preferences.categories.length > 0 &&
      draft.goals.trim().length > 0,
    [missingEducation, draft],
  );

  const addLanguage = () => {
    const name = langName.trim();
    if (!name) return;
    if (draft.languages.some((lang) => lang.toLowerCase() === name.toLowerCase())) return;
    manual("languages", {
      ...draft,
      languages: [...draft.languages, name],
      languageDetails: [...draft.languageDetails, { name, level: langLevel }],
    });
    setLangName("");
  };

  const removeLanguage = (name: string) =>
    manual("languages", {
      ...draft,
      languages: draft.languages.filter((item) => item !== name),
      languageDetails: draft.languageDetails.filter((item) => item.name !== name),
    });

  const setFunding = (key: "tuition" | "living" | "travel", value: boolean) =>
    manual("fundingNeeds", { ...draft, fundingNeeds: { ...draft.fundingNeeds, [key]: value } });

  return (
    <div>
      <p className="eyebrow">Step 4 of 5</p>
      <h2 className="mt-1 text-2xl">Add anything that's missing</h2>
      <p className="mt-1 text-muted-foreground">
        A few focused questions. Each one explains why it helps match you with opportunities. Skip
        anything that doesn't apply.
      </p>

      {nothingMissing && (
        <p className="mt-5 border border-border bg-teal-soft p-4 text-sm">
          Your profile already covers the essentials — review or refine anything below, or
          continue.
        </p>
      )}

      <div className="mt-5 grid gap-4">
        {showEducation && (
          <Question
            title="Your education"
            why="Most opportunities ask for a degree level and field of study, so this drives almost every match."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <F id="gap-degree-level" label="Degree level">
                <select
                  id="gap-degree-level"
                  value={draft.education[0]?.degreeLevel ?? ""}
                  onChange={(event) =>
                    updateEducation({
                      degreeLevel: (event.target.value || null) as DegreeLevel | null,
                    })
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
              <F id="gap-school" label="School or university">
                <input
                  id="gap-school"
                  value={draft.education[0]?.school ?? ""}
                  onChange={(event) => updateEducation({ school: event.target.value })}
                />
              </F>
            </div>
            <MultiSelect
              id="gap-field"
              label="Field of study"
              hint="Pick from the list or add your own."
              options={FIELD_OPTIONS}
              values={draft.education[0]?.field ? [draft.education[0].field] : []}
              onChange={(values) => updateEducation({ field: values[0] ?? "" })}
              max={1}
            />
            <GraduationControl
              value={draft.graduationDate}
              precision={draft.graduationDatePrecision}
              onChange={(date, precision) =>
                manual("graduationDate", {
                  ...draft,
                  graduationDate: date,
                  graduationDatePrecision: precision,
                  graduationYear: date ? Number(date.slice(0, 4)) || null : null,
                })
              }
            />
            {!addingEducation && (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddingEducation(true)}
                >
                  <Plus /> Add another education record
                </Button>
              </div>
            )}
            {addingEducation && (
              <div className="grid gap-3 border border-border p-3">
                <F id="new-degree" label="Degree name">
                  <input
                    id="new-degree"
                    value={newDegree}
                    onChange={(event) => setNewDegree(event.target.value)}
                  />
                </F>
                <F id="new-school" label="School">
                  <input
                    id="new-school"
                    value={newSchool}
                    onChange={(event) => setNewSchool(event.target.value)}
                  />
                </F>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!newDegree.trim() && !newSchool.trim()}
                    onClick={() => {
                      manual("education", {
                        ...draft,
                        education: [
                          ...draft.education,
                          {
                            id: uid(),
                            degreeLevel: null,
                            degreeName: newDegree.trim(),
                            school: newSchool.trim(),
                            field: "",
                          },
                        ],
                      });
                      setNewDegree("");
                      setNewSchool("");
                      setAddingEducation(false);
                    }}
                  >
                    Add education
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingEducation(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {draft.education.length > 1 && (
              <ul className="grid gap-2">
                {draft.education.slice(1).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between border border-border p-2 text-sm"
                  >
                    <span>
                      {entry.degreeName || "Untitled"} — {entry.school || "No school"}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${entry.degreeName || "education record"}`}
                      onClick={() =>
                        manual("education", {
                          ...draft,
                          education: draft.education.filter((item) => item.id !== entry.id),
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Question>
        )}

        <Question
          title="Your skills"
          why="Skills help us explain why an opportunity fits you — they're never used to decide if you're eligible."
        >
          <MultiSelect
            id="gap-skills"
            label="Skills"
            hint="Search the list or add your own."
            options={SKILL_OPTIONS}
            values={draft.skills}
            onChange={(skills) => manual("skills", { ...draft, skills })}
          />
        </Question>

        <Question
          title="Languages"
          why="Some opportunities require or prefer certain languages."
        >
          <div className="flex flex-wrap items-end gap-2">
            <F id="lang-name" label="Language" className="flex-1">
              <input
                id="lang-name"
                list="language-options"
                value={langName}
                onChange={(event) => setLangName(event.target.value)}
              />
            </F>
            <datalist id="language-options">
              {LANGUAGE_OPTIONS.map((language) => (
                <option key={language} value={language} />
              ))}
            </datalist>
            <F id="lang-level" label="Level">
              <select
                id="lang-level"
                value={langLevel}
                onChange={(event) => setLangLevel(event.target.value)}
              >
                {LANGUAGE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </F>
            <Button type="button" onClick={addLanguage} disabled={!langName.trim()}>
              <Plus /> Add language
            </Button>
          </div>
          {draft.languageDetails.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {draft.languageDetails.map((lang) => (
                <li key={lang.name} className="chip chip-teal flex items-center gap-1">
                  {lang.name}
                  {lang.level ? ` (${lang.level})` : ""}
                  <button
                    type="button"
                    aria-label={`Remove ${lang.name}`}
                    className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center"
                    onClick={() => removeLanguage(lang.name)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Question>

        <Question
          title="What are you looking for?"
          why="This focuses your Discover feed on the opportunity types you care about."
        >
          <ChipRow
            options={CATEGORIES}
            labels={CATEGORY_LABELS}
            values={draft.preferences.categories}
            onToggle={(value) => {
              const category = value as Category;
              const categories = draft.preferences.categories.includes(category)
                ? draft.preferences.categories.filter((item) => item !== category)
                : [...draft.preferences.categories, category];
              manual("preferences.categories", {
                ...draft,
                preferences: { ...draft.preferences, categories },
              });
            }}
          />
          {wantsMasters && (
            <MultiSelect
              id="gap-masters-field"
              label="Preferred field for a Master's"
              hint="Shown because you picked Master's programmes."
              options={FIELD_OPTIONS}
              values={draft.education[0]?.field ? [draft.education[0].field] : []}
              onChange={(values) => updateEducation({ field: values[0] ?? "" })}
              max={1}
            />
          )}
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
          {!draft.preferences.remoteOk && (
            <MultiSelect
              id="gap-locations"
              label="Preferred locations"
              hint="Skipped when you're open to remote."
              options={LOCATION_OPTIONS}
              values={draft.preferences.locations}
              onChange={(locations) =>
                manual("preferences.locations", {
                  ...draft,
                  preferences: { ...draft.preferences, locations },
                })
              }
            />
          )}
        </Question>

        <Question
          title="Funding needs"
          why="So we can highlight opportunities whose funding actually covers what you need."
        >
          <label className="flex min-h-[44px] items-center gap-2 font-normal">
            <input
              type="checkbox"
              className="w-auto"
              checked={fundingAny}
              onChange={(event) => {
                const on = event.target.checked;
                manual("fundingNeeds", {
                  ...draft,
                  fundingNeeds: { tuition: on, living: false, travel: false },
                });
              }}
            />
            I need funding
          </label>
          {fundingAny && (
            <div className="grid gap-2 border-l-2 border-primary pl-4">
              <p className="text-sm font-semibold">What should funding cover?</p>
              {(
                [
                  ["tuition", "Tuition fees"],
                  ["living", "Living costs"],
                  ["travel", "Travel"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex min-h-[44px] items-center gap-2 font-normal">
                  <input
                    type="checkbox"
                    className="w-auto"
                    checked={draft.fundingNeeds[key]}
                    onChange={(event) => setFunding(key, event.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </Question>

        <Question
          title="Experience"
          why="Research, volunteer and work experience appear as reasons an opportunity fits you."
        >
          {experienceEditor}
        </Question>

        <Question
          title="Your goals"
          why="A sentence or two about what you want next helps rank opportunities by relevance."
        >
          <F id="gap-goals" label="Goals">
            <textarea
              id="gap-goals"
              rows={4}
              value={draft.goals}
              onChange={(event) => manual("goals", { ...draft, goals: event.target.value })}
              placeholder="For example: a funded Master's in public health starting next year…"
            />
          </F>
        </Question>
      </div>
    </div>
  );
}
