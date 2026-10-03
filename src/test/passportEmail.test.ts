import { describe, expect, it } from "vitest";
import { emailMatchState, normalizeEmail } from "@/lib/profileExtraction";
describe("passport email", () => {
  it("normalises and rejects invalid", () => {
    expect(normalizeEmail("  Amina@Uni.AC.ke ")).toBe("amina@uni.ac.ke");
    expect(normalizeEmail("not-an-email")).toBe("");
  });
  it("match states", () => {
    expect(emailMatchState("", "a@b.co")).toBe("missing");
    expect(emailMatchState("a@b.co", null)).toBe("not_connected");
    expect(emailMatchState("A@b.co", "a@b.co")).toBe("match");
    expect(emailMatchState("a@b.co", "x@b.co")).toBe("mismatch");
  });
});

import { canConfirmProfile } from "@/lib/profileExtraction";
import { EMPTY_PROFILE } from "@/data/fixtures";
describe("email required to make profile", () => {
  const base = {
    ...EMPTY_PROFILE,
    education: [{ id: "e", degreeLevel: null, degreeName: "BSc", school: "U", field: "" }],
  };
  it("blocks when missing", () => {
    expect(canConfirmProfile(base, 0).reason).toMatch(/Email missing/);
  });
  it("blocks invalid email", () => {
    expect(canConfirmProfile({ ...base, email: "abc" }, 0).ok).toBe(false);
  });
  it("allows valid email or opt-out", () => {
    expect(canConfirmProfile({ ...base, email: "a@b.co" }, 0).ok).toBe(true);
    expect(canConfirmProfile({ ...base, emailTrackingOptOut: true }, 0).ok).toBe(true);
  });
});
