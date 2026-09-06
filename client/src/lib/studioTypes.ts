export type PlushKind = "bear" | "rabbit" | "cat";

export type DesignState = {
  name: string;
  kind: PlushKind;
  heightCm: number;
  headScale: number;
  bodyScale: number;
  earScale: number;
  color: string;
  accent: string;
  keyring: boolean;
};

export type DesignPart = {
  id: string;
  code: string;
  name: string;
  type: string;
  material: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  toleranceMm: number;
};

export const initialDesign: DesignState = {
  name: "새 인형 디자인",
  kind: "bear",
  heightCm: 23,
  headScale: 1,
  bodyScale: 1,
  earScale: 1,
  color: "#B8765C",
  accent: "#F0D8B9",
  keyring: false,
};

export const initialParts: DesignPart[] = [
  { id: "body", code: "PT-01", name: "본체", type: "body", material: "쇼트파일 5mm", widthMm: 120, heightMm: 165, depthMm: 70, toleranceMm: 3 },
  { id: "head", code: "PT-02", name: "머리", type: "head", material: "쇼트파일 5mm", widthMm: 130, heightMm: 115, depthMm: 85, toleranceMm: 3 },
  { id: "ear-left", code: "PT-03", name: "왼쪽 귀", type: "ear", material: "샤무드", widthMm: 42, heightMm: 42, depthMm: 14, toleranceMm: 2 },
  { id: "ear-right", code: "PT-04", name: "오른쪽 귀", type: "ear", material: "샤무드", widthMm: 42, heightMm: 42, depthMm: 14, toleranceMm: 2 },
  { id: "arm-left", code: "PT-05", name: "왼쪽 팔", type: "arm", material: "쇼트파일 5mm", widthMm: 48, heightMm: 88, depthMm: 34, toleranceMm: 3 },
  { id: "arm-right", code: "PT-06", name: "오른쪽 팔", type: "arm", material: "쇼트파일 5mm", widthMm: 48, heightMm: 88, depthMm: 34, toleranceMm: 3 },
  { id: "foot-left", code: "PT-07", name: "왼쪽 발", type: "foot", material: "쇼트파일 5mm", widthMm: 58, heightMm: 70, depthMm: 48, toleranceMm: 3 },
  { id: "foot-right", code: "PT-08", name: "오른쪽 발", type: "foot", material: "쇼트파일 5mm", widthMm: 58, heightMm: 70, depthMm: 48, toleranceMm: 3 },
];
