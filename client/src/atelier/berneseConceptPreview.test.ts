import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./BerneseConceptPreview.tsx", import.meta.url), "utf8");

describe("Bernese concept preview", () => {
  it("keeps a user-controllable continuous Three.js rotation separate from the photo views", () => {
    expect(source).toContain("OrbitControls");
    expect(source).toContain("controls.autoRotate = autoRotate");
    expect(source).toContain("Bernese lying plush concept");
    expect(source).toContain("onUnavailable();");
  });

  it("retains core Bernese construction cues for the interaction prototype", () => {
    expect(source).toContain('"White face blaze"');
    expect(source).toContain('"Forepaw left"');
    expect(source).toContain('"Tail"');
    expect(source).toContain("const tag = new THREE.Mesh");
  });
});
