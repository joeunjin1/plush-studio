import { describe, expect, it } from "vitest";
import { templateIds, visualTemplateProfile } from "./productDefinition";

describe("visual template profiles", () => {
  it("marks the first enhanced Bear experience as a prototype rather than a factory-validated digital twin", () => {
    const bear = visualTemplateProfile("bear");
    expect(bear.level).toBe("prototype");
    expect(bear.constructionOverlay).toBe("key-seams");
    expect(bear.requiredNodes).toContain("SEAM_center");
    expect(bear.proofEligibility).toBe("buyer-review");
    expect(bear.attachmentAnchors[0]?.node).toBe("PART_body");
    expect(bear.uvPrintZones[0]?.uv.uMin).toBeLessThan(bear.uvPrintZones[0]?.uv.uMax ?? 0);
    expect(bear.performanceBudget.textureResolution).toBeLessThanOrEqual(2048);
  });

  it("keeps bag and apparel templates transparently labelled as concept previews until GLB validation", () => {
    expect(visualTemplateProfile("tote").level).toBe("concept");
    expect(visualTemplateProfile("tee-regular").printZoneMode).toBe("procedural");
    expect(visualTemplateProfile("tote").proofEligibility).toBe("exploratory");
  });

  it("keeps every template anchor and UV print zone within its declared digital-preview contract", () => {
    for (const templateId of templateIds) {
      const profile = visualTemplateProfile(templateId);
      expect(profile.proofEligibility).not.toBe("factory-release");
      expect(profile.attachmentAnchors.length).toBeGreaterThan(0);
      expect(profile.attachmentAnchors.every(anchor => anchor.node.startsWith("PART_"))).toBe(true);
      expect(profile.attachmentAnchors.every(anchor => anchor.allowed.length > 0)).toBe(true);
      expect(profile.uvPrintZones.length).toBeGreaterThan(0);
      for (const zone of profile.uvPrintZones) {
        expect(zone.meshNode).toBe("PART_body");
        expect(zone.uv.uMin).toBeGreaterThanOrEqual(0);
        expect(zone.uv.vMin).toBeGreaterThanOrEqual(0);
        expect(zone.uv.uMax).toBeLessThanOrEqual(1);
        expect(zone.uv.vMax).toBeLessThanOrEqual(1);
        expect(zone.uv.uMin).toBeLessThan(zone.uv.uMax);
        expect(zone.uv.vMin).toBeLessThan(zone.uv.vMax);
      }
    }
  });
});
