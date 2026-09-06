import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./FiveAngleReferencePreview.tsx", import.meta.url),
  "utf8"
);

describe("five-angle reference preview", () => {
  it("provides view-locked controls and an explicitly labelled photo-based limitation", () => {
    expect(source).toContain("referenceViewIds.map");
    expect(source).toContain("5면 자동 회전");
    expect(source).toContain("GLB 디지털 트윈과는 다르며");
  });

  it("offers selectable memorial-tag faces and constrained commemorative text", () => {
    expect(source).toContain("Object.keys(product.memorialTag.sides)");
    expect(source).toContain("product.memorialTag.sides[side].label");
    expect(source).toContain("maxLength={product.memorialTag.maxCharacters}");
  });
});
