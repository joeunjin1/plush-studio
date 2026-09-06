import { getTemplate, validateDesignReadiness } from "./productDefinition";
import type { Project } from "./project";

export type DesignProof = {
  proofId: string;
  status: "CONCEPT" | "DESIGN_READY" | "REVIEW_REQUIRED";
  projectName: string;
  productLabel: string;
  templateLabel: string;
  revision: number;
  updatedAt: string;
  dimensions: string;
  materials: Array<{ label: string; value: string }>;
  parts: Array<{ name: string; kind: string }>;
  bom: Array<{
    partId: string;
    name: string;
    dimensions: string;
    materialSlot: string;
    fabric: string;
    trims: string;
    process: string;
    toleranceMm: number;
  }>;
  artworkCount: number;
  viewExports: string[];
  issues: ReturnType<typeof validateDesignReadiness>;
  disclaimer: string;
};
export type ProofExportPlan = {
  proofId: string;
  revision: number;
  projectName: string;
  files: Array<{ view: "front" | "side" | "back"; filename: string }>;
};
export function proofViewFileNames(projectName: string) {
  return (["front", "side", "back"] as const).map(view => `${projectName}-design-proof-${view}.png`);
}
export function buildProofExportPlan(proof: Pick<DesignProof, "proofId" | "revision" | "projectName">): ProofExportPlan {
  const views = ["front", "side", "back"] as const;
  const filenames = proofViewFileNames(proof.projectName);
  return {
    proofId: proof.proofId,
    revision: proof.revision,
    projectName: proof.projectName,
    files: views.map((view, index) => ({ view, filename: filenames[index]! })),
  };
}

export function buildDesignProof(project: Project): DesignProof {
  const template = getTemplate(project.templateId!);
  const issues = validateDesignReadiness({
    product: project.product,
    templateId: project.templateId!,
    width: project.width,
    height: project.height,
    depth: project.depth,
    parts: project.parts,
    materials: project.materials,
    decals: project.decals,
    assets: project.assets,
    references: project.references,
    useOutline: project.useOutline,
    front: project.front,
    side: project.side,
  });
  const hasErrors = issues.some(issue => issue.level === "error");
  const status = hasErrors
    ? "REVIEW_REQUIRED"
    : issues.length
      ? "CONCEPT"
      : "DESIGN_READY";
  return {
    proofId: `PS-${project.id.slice(0, 8).toUpperCase()}-R${project.revision}`,
    status,
    projectName: project.name,
    productLabel: project.product === "plush" ? "인형" : project.product === "bag" ? "가방" : "티셔츠",
    templateLabel: template.label,
    revision: project.revision,
    updatedAt: project.updatedAt,
    dimensions: `${project.width} × ${project.height} × ${project.depth}cm`,
    materials: template.materialSlots.map(slot => ({
      label: slot.label,
      value: slot.options.find(option => option.value === project.materials[slot.id])?.label ?? "선택 필요",
    })),
    parts: project.parts.map(part => ({ name: part.name, kind: part.kind ?? "사용자 추가 부위" })),
    bom: project.parts.map(part => ({
      partId: part.id,
      name: part.name,
      dimensions: `${part.width} × ${part.height} × ${part.depth}cm`,
      materialSlot: part.materialSlot ?? "body",
      fabric: part.fabric || "원단 지정",
      trims: part.trims || "해당 없음",
      process: part.process,
      toleranceMm: part.toleranceMm,
    })),
    artworkCount: project.decals.length,
    viewExports: proofViewFileNames(project.name),
    issues,
    disclaimer:
      "Design Proof는 선택한 템플릿·치수·소재·그래픽 배치를 기록한 디자인 검토 자료입니다. 실제 샘플, 색상, 원단 촉감 및 공정 가능 여부는 Expert Verified 단계에서 최종 확인해야 합니다.",
  };
}
export function productionRequestEligibility(project: Project) {
  const proof = buildDesignProof(project);
  return { proof, eligible: proof.status !== "REVIEW_REQUIRED" };
}
