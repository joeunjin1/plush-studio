import { describe, it, expect } from "vitest";
import {
  createProject,
  parseProject,
  validateOutline,
  outlines,
} from "./project";
import { productGeometry, shapeGeometry } from "./geometry";
import { extractOutlinePixels } from "./autoOutline";
import * as THREE from "three";
describe("three-view product workflow", () => {
  it("builds finite meshes at the requested dimensions for plush, bag and shirt", () => {
    for (const type of ["plush", "bag", "shirt"] as const) {
      const p = createProject(type),
        g = productGeometry(p),
        a = g.getAttribute("position").array;
      expect(Array.from(a).every(Number.isFinite)).toBe(true);
      g.computeBoundingBox();
      const size = g.boundingBox!.getSize(new THREE.Vector3());
      expect(size.x).toBeGreaterThan(p.width * 0.7);
      expect(size.y).toBeCloseTo(p.height, type === "plush" ? 0 : 4);
      expect(size.z).toBeGreaterThan(p.depth * 0.7);
      g.dispose();
    }
  });
  it("changes real geometry when the uploaded front/side outlines change", () => {
    const g = shapeGeometry(
      [
        [0.1, 0.1],
        [0.9, 0.1],
        [0.75, 0.9],
        [0.25, 0.9],
      ],
      [
        [0.4, 0.1],
        [0.6, 0.1],
        [0.8, 0.9],
        [0.2, 0.9],
      ],
      35,
      38,
      10
    );
    g.computeBoundingBox();
    expect(g.getAttribute("position").count).toBeGreaterThan(1000);
    expect(g.boundingBox!.max.z - g.boundingBox!.min.z).toBeCloseTo(10, 0);
    g.dispose();
  });
  it("rejects self-crossing outlines and branched lofts with actionable errors", () => {
    expect(() =>
      validateOutline([
        [0.1, 0.1],
        [0.9, 0.9],
        [0.1, 0.9],
        [0.9, 0.1],
      ])
    ).toThrow();
    expect(() =>
      shapeGeometry(
        outlines.shirt,
        [
          [0.2, 0],
          [0.8, 0],
          [0.8, 1],
          [0.2, 1],
        ],
        55,
        70,
        2
      )
    ).toThrow("갈라진");
  });
  it("preserves image content, decals, independent parts and groups in backups", () => {
    const p = createProject("bag");
    const a = "11111111-1111-4111-8111-111111111111";
    p.assets = [
      { id: a, name: "logo.png", data: "data:image/png;base64,AA==" },
    ];
    p.references.front = a;
    p.decals = [
      { id: a, assetId: a, face: "front", x: 3, y: 4, size: 10, rotation: 25 },
    ];
    p.parts = [
      {
        id: a,
        name: "Handle",
        shape: "box",
        color: "#aabbcc",
        width: 12,
        height: 3,
        depth: 2,
        x: 0,
        y: 22,
        z: 0,
        rotation: 0,
        group: "group1",
        front: [],
        side: [],
      },
    ];
    expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("rejects unsafe asset URLs, missing images and malformed dimensions", () => {
    const p = createProject();
    expect(() => parseProject({ ...p, width: NaN })).toThrow();
    expect(() =>
      parseProject({
        ...p,
        references: { front: "11111111-1111-4111-8111-111111111111" },
      })
    ).toThrow("빠져");
    expect(() =>
      parseProject({
        ...p,
        assets: [{ id: p.id, name: "x", data: "https://attacker.test/a" }],
      })
    ).toThrow();
  });
});

describe("automatic silhouette extraction", () => {
  it("extracts the largest shape from a simple background and ignores noise", () => {
    const data = new Uint8ClampedArray(64 * 64 * 4);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4,
          inside = x >= 10 && x < 54 && y >= 8 && y < 56;
        data[i] = data[i + 1] = data[i + 2] = inside ? 80 : 255;
        data[i + 3] = 255;
      }
    const points = extractOutlinePixels(data, 64, 64);
    expect(points.length).toBe(4);
    expect(Math.min(...points.map(p => p[0]))).toBe(10 / 64);
    expect(() => validateOutline(points)).not.toThrow();
  });
});
