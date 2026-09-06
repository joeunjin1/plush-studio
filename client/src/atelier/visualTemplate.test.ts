import { describe, expect, it } from "vitest";
import { visualTemplateProfile } from "./productDefinition";

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
});
