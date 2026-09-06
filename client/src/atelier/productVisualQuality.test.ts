import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { productGeometry } from "./geometry";
import { createProjectFromTemplate } from "./project";
import {
  resolveTemplateParts,
  templateIds,
  visualTemplateProfile,
} from "./productDefinition";

const previewSource = readFileSync(
  new URL("./ProductPreview.tsx", import.meta.url),
  "utf8"
);

describe("core product visual quality", () => {
  it("keeps lightweight material texture treatments for plush, woven fabric, and nylon", () => {
    expect(previewSource).toContain('materialName === "minky"');
    expect(previewSource).toContain('materialName === "canvas"');
    expect(previewSource).toContain('materialName === "poly"');
  });

  it("keeps product-family construction detail overlays", () => {
    expect(previewSource).toContain('details.name = "DETAIL_plush_face"');
    expect(previewSource).toContain('group.name = "SEAM_bag_panels"');
    expect(previewSource).toContain('group.name = "SEAM_shirt_details"');
  });

  it("preserves volume in the primary plush, bag, and shirt bodies", () => {
    const templates = ["bear", "rabbit", "cat", "keyring", "cushion", "tote", "tee-regular"] as const;
    templates.forEach(templateId => {
      const project = createProjectFromTemplate(templateId);
      const geometry = productGeometry(project);
      const size = geometry.boundingBox!.getSize(new THREE.Vector3());
      const bodyHeightRatio = ["rabbit", "cat", "keyring"].includes(templateId)
        ? 0.55
        : 0.7;
      expect(size.x).toBeGreaterThan(project.width * 0.7);
      expect(size.y).toBeGreaterThan(project.height * bodyHeightRatio);
      expect(size.z).toBeGreaterThan(project.depth * 0.7);
      geometry.dispose();
    });
  });

  it("keeps distinctive plush template proportions without changing their existing parts", () => {
    const rabbit = createProjectFromTemplate("rabbit");
    const cat = createProjectFromTemplate("cat");
    const keyring = createProjectFromTemplate("keyring");

    expect(rabbit.parts.filter(part => part.kind?.startsWith("ear")).every(part => part.height >= 12)).toBe(true);
    expect(cat.parts.some(part => part.kind === "tail")).toBe(true);
    expect(keyring.parts.some(part => part.kind === "keyring-loop")).toBe(true);
    expect(Math.max(...keyring.parts.map(part => Math.abs(part.y) + part.height / 2))).toBeLessThan(keyring.height);
    expect(previewSource).toContain('seam.name = "SEAM_cushion_perimeter"');
    expect(previewSource).toContain('seam.name = "SEAM_plush_center"');
  });

  it("keeps every implemented visual parameter mapping responsive", () => {
    const rabbit = createProjectFromTemplate("rabbit");
    rabbit.parameters.earAngle = 18;
    const ear = resolveTemplateParts(rabbit).find(part => part.kind === "ear-left");
    expect(ear?.rotation).toBe(-30);

    const cat = createProjectFromTemplate("cat");
    cat.parameters.tailLength = 18;
    expect(resolveTemplateParts(cat).find(part => part.kind === "tail")?.height).toBe(18);

    const crossbody = createProjectFromTemplate("crossbody");
    crossbody.parameters.strapLength = 140;
    expect(resolveTemplateParts(crossbody).find(part => part.kind === "strap")?.height).toBe(58);

    const backpack = createProjectFromTemplate("backpack");
    backpack.parameters.capacity = "medium";
    expect(resolveTemplateParts(backpack).find(part => part.kind === "front-pocket")?.width).toBeCloseTo(20.88);

    const tote = createProjectFromTemplate("tote");
    tote.parameters.closure = "open";
    expect(resolveTemplateParts(tote).some(part => part.kind === "zipper")).toBe(false);
    tote.parameters.closure = "magnet";
    expect(resolveTemplateParts(tote).find(part => part.kind === "zipper")?.name).toBe("자석 여밈");

    const bear = createProjectFromTemplate("bear");
    bear.parameters.pose = "sitting";
    expect(resolveTemplateParts(bear).find(part => part.kind === "leg-left")?.y).toBe(-5.8);
  });

  it("keeps every template within its declared lightweight fallback budget", () => {
    templateIds.forEach(templateId => {
      const budget = visualTemplateProfile(templateId).performanceBudget;
      expect(budget.mobileMb).toBeLessThanOrEqual(3);
      expect(budget.desktopMb).toBeLessThanOrEqual(8);
      expect(budget.mobileFps).toBeGreaterThanOrEqual(30);
      expect(budget.textureResolution).toBeLessThanOrEqual(2048);
    });
  });
});
