import { createProject, createProjectFromTemplate, parseProject } from "./project";
import { getPrintZones, requiredViewsFor, resolveTemplateParts, templatesFor, validateDesignReadiness } from "./productDefinition";
import { describe, expect, it } from "vitest";

describe("product definition engine", () => {
  it("creates structured templates with required parts for each product family", () => {
    for (const product of ["plush", "bag", "shirt"] as const) {
      const project = createProject(product);
      expect(project.templateId).toBe(templatesFor(product)[0]?.id);
      expect(project.parts.length).toBeGreaterThanOrEqual(templatesFor(product)[0]?.requiredKinds.length ?? 0);
      expect(project.materials).not.toEqual({});
    }
  });

  it("backfills a compatible template and material slots for legacy projects", () => {
    const legacy = createProject("bag");
    delete (legacy as Partial<typeof legacy>).templateId;
    delete (legacy as Partial<typeof legacy>).materials;
    const parsed = parseProject(legacy);
    expect(parsed.templateId).toBe("tote");
    expect(parsed.materials.body).toBeTruthy();
  });

  it("flags a graphic that leaves the printable safety zone", () => {
    const project = createProject("shirt");
    project.assets = [{ id: project.id, name: "art.png", width: 200, height: 200 }];
    project.decals = [{ id: project.id, assetId: project.id, face: "front", x: 100, y: 100, size: 20, rotation: 0 }];
    const issues = validateDesignReadiness(project);
    expect(issues.some(issue => issue.code === "print-zone-0" && issue.level === "error")).toBe(true);
    expect(getPrintZones(project)[0]?.width).toBeGreaterThan(0);
  });

  it("flags artwork that lacks the pixel dimensions required for its print size", () => {
    const project = createProject("shirt");
    project.assets = [{ id: project.id, name: "small.png", width: 100, height: 100 }];
    project.decals = [{ id: project.id, assetId: project.id, face: "front", x: 0, y: 0, size: 10, rotation: 0 }];
    const issues = validateDesignReadiness(project);
    expect(issues.some(issue => issue.code === "print-resolution-0" && issue.level === "error")).toBe(true);
  });

  it("requires product-specific reference views and a valid custom outline", () => {
    const bag = createProject("bag");
    const bagIssues = validateDesignReadiness(bag);
    expect(requiredViewsFor("bag")).toEqual(["front", "side", "back"]);
    expect(bagIssues.some(issue => issue.code === "required-view-back" && issue.level === "error")).toBe(true);

    const plush = createProject("plush");
    plush.useOutline = true;
    plush.front = [[0.5, 0.5], [0.51, 0.51]];
    const plushIssues = validateDesignReadiness(plush);
    expect(plushIssues.some(issue => issue.code === "outline-front-required" || issue.code === "outline-front")).toBe(true);
  });

  it("applies product-specific settings to the matching structural parts", () => {
    const rabbit = createProject("plush");
    rabbit.templateId = "rabbit";
    rabbit.parameters = { earAngle: 18 };
    const ears = resolveTemplateParts({ templateId: "rabbit", parameters: rabbit.parameters, parts: rabbit.parts })
      .filter(part => part.kind?.startsWith("ear-"));
    expect(ears[0]?.rotation).not.toBe(ears[1]?.rotation);

    const crossbody = createProjectFromTemplate("crossbody");
    crossbody.parameters = { strapLength: 140 };
    const strap = resolveTemplateParts({ templateId: "crossbody", parameters: crossbody.parameters, parts: crossbody.parts })
      .find(part => part.kind === "strap");
    expect(strap?.height).toBeGreaterThan(28);

    const tote = createProject("bag");
    const openTop = resolveTemplateParts({ templateId: "tote", parameters: { closure: "open" }, parts: tote.parts });
    const magneticTop = resolveTemplateParts({ templateId: "tote", parameters: { closure: "magnet" }, parts: tote.parts });
    expect(openTop.some(part => part.kind === "zipper")).toBe(false);
    expect(magneticTop.find(part => part.kind === "zipper")?.name).toBe("자석 여밈");
  });
});
