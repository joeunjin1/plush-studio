import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { previewCameraDistance, previewFrameSize } from "./ProductPreview";

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

  it("centers on the primary body while reserving room for asymmetric accessories", () => {
    const bounds = new THREE.Box3(
      new THREE.Vector3(-10, -12, -6),
      new THREE.Vector3(22, 12, 6)
    );
    const bodyCenter = new THREE.Vector3(0, 0, 0);

    expect(previewFrameSize(bounds, bodyCenter)).toEqual(
      new THREE.Vector3(44, 24, 12)
    );
  });
});
