import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { productGeometry } from "./geometry";
import { createProject, createProjectFromTemplate } from "./project";

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

  it("builds rounded volume for the default bag and a structured shirt silhouette", () => {
    const tote = productGeometry(createProjectFromTemplate("tote"));
    const tee = productGeometry(createProjectFromTemplate("tee-regular"));
    const toteSize = tote.boundingBox!.getSize(new THREE.Vector3());
    const teeSize = tee.boundingBox!.getSize(new THREE.Vector3());

    expect(tote.getAttribute("position").count).toBeGreaterThan(100);
    expect(tee.getAttribute("position").count).toBeGreaterThan(100);
    expect(toteSize.z).toBeGreaterThan(9);
    expect(teeSize.y).toBeGreaterThan(65);
    tote.dispose();
    tee.dispose();
  });
});
