import { describe, expect, it } from "vitest";
import {
  bernesePersonalizationProfileIds,
  constrainPersonalizationText,
  personalizationProfiles,
  profilesForReferenceProduct,
  validatePersonalizationFile,
} from "./personalizationProfiles";

describe("personalization method profiles", () => {
  it("limits the Bernese catalog product to its registered memorial-tag method", () => {
    expect(profilesForReferenceProduct("plush", bernesePersonalizationProfileIds).map(profile => profile.code)).toEqual([
      "MEMORIAL_TAG_TEXT_V01",
      "MEMORIAL_TAG_BRAND_V01",
    ]);
  });

  it("keeps line and character limits in the reusable profile", () => {
    const profile = personalizationProfiles.find(item => item.id === "memorial-tag-text-v01")!;
    expect(constrainPersonalizationText("one\ntwo\nthree\nfour", profile.constraints)).toBe("one\ntwo\nthree");
  });

  it("rejects artwork outside the profile file policy", () => {
    const profile = personalizationProfiles.find(item => item.id === "front-screen-print-v01")!;
    expect(validatePersonalizationFile({ type: "application/pdf", size: 1 }, profile.constraints)).toContain("PNG");
    expect(validatePersonalizationFile({ type: "image/png", size: 6 * 1024 * 1024 }, profile.constraints)).toContain("5MB");
  });

  it("requires every reusable method profile to include a factory review note", () => {
    expect(personalizationProfiles.every(profile => profile.factoryReviewNote.trim().length > 12)).toBe(true);
  });
});
