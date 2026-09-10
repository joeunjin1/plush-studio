import { describe, expect, it } from "vitest";
import {
  hasCompleteRequiredReferencePhotoSet,
  allReferencePhotoViews,
  referencePhotoStoragePath,
  requiredReferencePhotoViews,
} from "./referenceProductPhotoRegistration";
import intakeSource from "./ReferenceProductPhotoIntake.tsx?raw";

const organizationId = "3d6c0a4f-7041-4b3d-bfd8-6a9df18dbb0a";
const productId = "4c7de1a1-b0f7-4c5f-9bbf-c1d4ad678a50";

describe("reference product photo registration", () => {
  it("uses an organization and product scoped private source path", () => {
    expect(referencePhotoStoragePath(organizationId, productId, "front", "bernese-front-v01.webp"))
      .toBe(`${organizationId}/reference-products/${productId}/images/front/bernese-front-v01.webp`);
  });

  it("requires the exact five required reference directions", () => {
    const complete = Object.fromEntries(requiredReferencePhotoViews.map(view => [view, new File(["x"], `${view}.webp`, { type: "image/webp" })]));
    expect(hasCompleteRequiredReferencePhotoSet(complete)).toBe(true);
    expect(hasCompleteRequiredReferencePhotoSet({ front: complete.front })).toBe(false);
    expect(allReferencePhotoViews).toContain("detail");
  });

  it("cleans up private files and metadata when a batch intake does not complete", () => {
    expect(intakeSource).toContain("const insertedPaths: string[] = []");
    expect(intakeSource).toContain('.delete().in("source_storage_path", insertedPaths)');
    expect(intakeSource).toContain('.remove(uploadedPaths)');
  });
});
