import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE } from "@/data/fixtures";
import {
  acceptExperience,
  applyExtractedCandidates,
  dismissExperience,
} from "@/lib/profileExtraction";
import type { WorkExperienceEntry } from "@/domain/types";

const role = (id: string, r: string): WorkExperienceEntry => ({
  id,
  role: r,
  organization: "Test Lab",
  type: "research",
  location: "",
  description: "",
  sourceFile: "cv.pdf",
  snippet: "",
  outputs: ["Poster"],
  progress: "",
});

describe("experience suggestions", () => {
  it("extracted roles become suggestions, not profile entries, until accepted", () => {
    const res = [
      {
        ok: true,
        document: { name: "cv.pdf", label: "cv" as const },
        candidates: [],
        experiences: [role("a", "RA")],
        warnings: [],
        error: null,
      },
    ];
    const p = applyExtractedCandidates(EMPTY_PROFILE, res);
    expect(p.workExperience).toHaveLength(0);
    expect(p.experienceSuggestions).toHaveLength(1);
    const again = applyExtractedCandidates(p, res);
    expect(again.experienceSuggestions).toHaveLength(1);
    const accepted = acceptExperience(again, "a");
    expect(accepted.workExperience).toHaveLength(1);
    expect(accepted.experienceSuggestions).toHaveLength(0);
    expect(applyExtractedCandidates(accepted, res).experienceSuggestions).toHaveLength(0);
    expect(dismissExperience(p, "a").experienceSuggestions).toHaveLength(0);
  });
});
