import { describe, expect, it } from "vitest";
import {
  analyzeOwnerGlb,
  ownerGlbPerformanceMessage,
  ownerModelStoragePath,
  validateOwnerGlbFile,
} from "./ownerModelRegistration";

function glbFor(document: object) {
  const json = new TextEncoder().encode(JSON.stringify(document));
  const paddedLength = Math.ceil(json.byteLength / 4) * 4;
  const bytes = new Uint8Array(20 + paddedLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.byteLength, true);
  view.setUint32(12, paddedLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(json, 20);
  return bytes.buffer;
}

describe("owner GLB intake helpers", () => {
  it("reads model complexity from a GLB 2.0 JSON chunk", () => {
    const analysis = analyzeOwnerGlb(glbFor({
      accessors: [{ count: 9 }],
      meshes: [{ primitives: [{ indices: 0 }] }],
      materials: [{}],
      images: [{}],
      animations: [],
    }));
    expect(analysis).toEqual({
      meshCount: 1,
      triangleCount: 3,
      materialCount: 1,
      embeddedTextureCount: 1,
      hasAnimations: false,
    });
  });

  it("uses private organization-scoped paths with a stable model version", () => {
    expect(ownerModelStoragePath(
      "2ce4bf02-2de5-4ef2-9d82-66c0e4f8b529",
      "v03",
      "Bernese master.glb"
    )).toBe("2ce4bf02-2de5-4ef2-9d82-66c0e4f8b529/reference-products/models/v03/Bernese-master.glb");
  });

  it("rejects unsupported owner uploads and marks excessive complexity for review", () => {
    expect(() => validateOwnerGlbFile(new File(["data"], "model.fbx", { type: "model/gltf-binary" }))).toThrow("GLB");
    const file = new File(["data"], "model.glb", { type: "model/gltf-binary" });
    expect(ownerGlbPerformanceMessage(file, {
      meshCount: 1,
      triangleCount: 75_001,
      materialCount: 1,
      embeddedTextureCount: 1,
      hasAnimations: false,
    })).toContain("초과");
  });
});
