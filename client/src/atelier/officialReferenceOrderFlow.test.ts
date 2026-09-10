import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const atelier = readFileSync(new URL("./Atelier.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("./FiveAngleReferencePreview.tsx", import.meta.url), "utf8");

describe("official reference product order flow", () => {
  it("creates the same resumable draft whether a buyer chooses from the mall or the sidebar", () => {
    expect(atelier).toContain("const selectReferenceProduct");
    expect(atelier.match(/selectReferenceProduct\(product\)/g)?.length).toBe(2);
    expect(atelier).toContain("restoreReferenceProductOrderDraft(product.id)");
  });

  it("moves confirmed personalization into the protected reference order submit path", () => {
    expect(preview).toContain("onPersonalizationConfirm");
    expect(atelier).toContain("<ReferenceProductOrderPanel");
    expect(atelier).toContain("submitReferenceProductOrder(");
    expect(atelier).toContain('setProtectedArtifact("제작 견적 요청")');
  });

  it("clears the official order draft when the buyer returns to the generic 3D editor", () => {
    expect(atelier).toContain("setReferenceOrder(null)");
  });
});
