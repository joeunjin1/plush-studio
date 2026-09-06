import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { previewCameraDistance } from "./ProductPreview";

describe("ProductPreview camera framing", () => {
  it("keeps a full configured product inside a padded desktop frustum", () => {
    const size = new THREE.Vector3(24, 30, 18);
    const fov = 35;
    const aspect = 1.35;
    const distance = previewCameraDistance(size, fov, aspect);
    const verticalHalfAngle = THREE.MathUtils.degToRad(fov / 2);
    const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * aspect);

    expect(2 * distance * Math.tan(verticalHalfAngle)).toBeGreaterThan(size.y * 1.45);
    expect(2 * distance * Math.tan(horizontalHalfAngle)).toBeGreaterThan(size.x * 1.45);
  });

  it("increases the framing distance when the product becomes taller", () => {
    const compact = previewCameraDistance(new THREE.Vector3(20, 20, 12), 35, 1.35);
    const tall = previewCameraDistance(new THREE.Vector3(20, 36, 12), 35, 1.35);

    expect(tall).toBeGreaterThan(compact);
  });
});
