import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { makeModel } from "./ThreeDesigner";
import { initialDesign } from "@/lib/studioTypes";
describe("manufacturing model export", () => {
  it("uses unique part names and grounds every preset", () => {
    for (const kind of ["bear", "rabbit", "cat"] as const) {
      const model = makeModel({ ...initialDesign, kind });
      const box = new THREE.Box3().setFromObject(model);
      expect(box.min.y).toBeCloseTo(0, 5);
      expect(box.max.y).toBeCloseTo(4.5, 5);
      expect(new Set(model.children.map(p => p.name)).size).toBe(
        model.children.length
      );
    }
  });
  it("uses distinct cat geometry", () => {
    const cat = makeModel({ ...initialDesign, kind: "cat" });
    expect(
      (cat.children.find(p => p.name.startsWith("Ear-")) as THREE.Mesh).geometry
        .type
    ).toBe("ConeGeometry");
  });
  it("converts selected centimeters to GLB meters", () => {
    for (const heightCm of [8, 23, 100]) {
      const model = makeModel({
        ...initialDesign,
        heightCm,
        kind: "rabbit",
        keyring: true,
      });
      const box = new THREE.Box3().setFromObject(model);
      const factor = heightCm / 100 / (box.max.y - box.min.y);
      model.scale.multiplyScalar(factor);
      model.position.multiplyScalar(factor);
      const exported = new THREE.Box3().setFromObject(model);
      expect(exported.max.y - exported.min.y).toBeCloseTo(heightCm / 100, 6);
    }
  });
});
