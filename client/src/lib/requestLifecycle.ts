export const requestStages = [
  "received",
  "reviewing",
  "quoted",
  "confirmed",
  "sample_review",
  "production_qa",
  "completed",
  "closed",
] as const;

export type RequestStage = (typeof requestStages)[number];

export const requestStageLabels: Record<RequestStage, string> = {
  received: "접수 완료",
  reviewing: "제작 가능 여부 검토",
  quoted: "견적 안내",
  confirmed: "고객 견적 수락",
  sample_review: "샘플 검토",
  production_qa: "양산 QA",
  completed: "제작 완료",
  closed: "상담 종료",
};

const transitions: Record<RequestStage, RequestStage[]> = {
  received: ["reviewing", "closed"],
  reviewing: ["quoted", "closed"],
  quoted: ["confirmed", "closed"],
  confirmed: ["sample_review", "closed"],
  sample_review: ["production_qa", "closed"],
  production_qa: ["completed", "closed"],
  completed: [],
  closed: [],
};

export function isRequestStage(value: string): value is RequestStage {
  return requestStages.includes(value as RequestStage);
}

export function nextRequestStages(current: string): RequestStage[] {
  return isRequestStage(current) ? transitions[current] : [];
}

export function canTransitionRequest(from: string, to: string): boolean {
  return isRequestStage(to) && nextRequestStages(from).includes(to);
}
