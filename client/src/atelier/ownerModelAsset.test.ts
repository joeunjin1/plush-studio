import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./referenceProducts.ts", import.meta.url), "utf8");

describe("owner-supplied GLB catalog contract", () => {
  it("uses a versioned owner asset key and retains checksum metadata", () => {
    expect(source).toContain("bernese-memorial-plush/3d/berner_plush_360_v02.glb");
    expect(source).toContain("checksumSha256");
    expect(source).toContain("대표 제공 GLB 3D 제품 뷰");
    expect(source).toContain("eeebf4aba5861150ae0eca006cf85bb7d0583e7b9400c15ff60ac2106ac647d5");
  });
});
