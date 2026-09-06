import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const previewSource = readFileSync(
  new URL("./ProductPreview.tsx", import.meta.url),
  "utf8"
);
const proofSource = readFileSync(
  new URL("./ConfiguratorPanels.tsx", import.meta.url),
  "utf8"
);

describe("protected export audit flow", () => {
  it("awaits audit completion before success messaging for 3D and proof exports", () => {
    expect(previewSource).toContain('await onProtectedExport("부위 분리 GLB")');
    expect(previewSource).toContain('await onProtectedExport("Design Proof 3면 PNG")');
    expect(proofSource).toContain('await onProtectedExport("Design Proof JSON")');
    expect(proofSource).toContain('await onProtectedExport("Design Proof PDF")');
  });

  it("uses an explicit callback result instead of assuming audit success", () => {
    expect(previewSource).toContain('onProtectedExport("완성 미리보기 PNG").then(recorded =>');
    expect(previewSource).toContain("if (recorded) onMessage");
  });
});
