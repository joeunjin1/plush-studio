import { describe, expect, it } from "vitest";
import { buildDesignProof, buildProofExportPlan, productionRequestEligibility, proofViewFileNames } from "./designProof";
import { createProject } from "./project";
import { requiredViewsFor } from "./productDefinition";

describe("Design Proof", () => {
  it("marks missing required views as requiring review and records repeatable Proof view filenames", () => {
    const proof = buildDesignProof(createProject("bag"));
    expect(proof.proofId).toMatch(/^PS-[A-F0-9]{8}-R0$/);
    expect(proof.status).toBe("REVIEW_REQUIRED");
    expect(proof.parts.some(part => part.kind === "handle-left")).toBe(true);
    expect(proof.viewExports).toEqual(proofViewFileNames(proof.projectName));
    expect(buildProofExportPlan(proof)).toEqual({
      proofId: proof.proofId,
      revision: proof.revision,
      projectName: proof.projectName,
      files: [
        { view: "front", filename: `${proof.projectName}-design-proof-front.png` },
        { view: "side", filename: `${proof.projectName}-design-proof-side.png` },
        { view: "back", filename: `${proof.projectName}-design-proof-back.png` },
      ],
    });
    expect(proofViewFileNames("테스트 가방")).toEqual([
      "테스트 가방-design-proof-front.png",
      "테스트 가방-design-proof-side.png",
      "테스트 가방-design-proof-back.png",
    ]);
  });

  it("marks invalid dimensions as requiring review", () => {
    const project = createProject("shirt");
    project.width = 150;
    const proof = buildDesignProof(project);
    expect(proof.status).toBe("REVIEW_REQUIRED");
    expect(proof.issues.some(issue => issue.code === "dimension-width")).toBe(true);
  });

  it("allows production requests only when every product family supplies its required views", () => {
    for (const product of ["plush", "bag", "shirt"] as const) {
      const project = createProject(product);
      expect(productionRequestEligibility(project).eligible).toBe(false);
      project.references = Object.fromEntries(requiredViewsFor(product).map(view => [view, project.id]));
      expect(productionRequestEligibility(project).eligible).toBe(true);
    }
  });
});
