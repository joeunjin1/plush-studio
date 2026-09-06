import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { productGeometry } from "./geometry";
import { createProject } from "./project";

describe("productGeometry", () => {
  it("uses a smooth high-segment primary body for the Basic Bear prototype", () => {
    const project = createProject("plush");
    const geometry = productGeometry(project);
    const position = geometry.getAttribute("position");
    const size = geometry.boundingBox!.getSize(new THREE.Vector3());

    expect(position.count).toBeGreaterThan(2_000);
    expect(size.x).toBeGreaterThan(project.width * 0.7);
    expect(size.y).toBeCloseTo(project.height, 0);
    expect(size.z).toBeGreaterThan(project.depth * 0.9);
    geometry.dispose();
  });
});
