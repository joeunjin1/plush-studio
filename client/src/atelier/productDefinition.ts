export type ProductKind = "plush" | "bag" | "shirt";
export type TemplateId =
  | "bear"
  | "rabbit"
  | "cat"
  | "keyring"
  | "cushion"
  | "tote"
  | "pouch"
  | "crossbody"
  | "backpack"
  | "eco-bag"
  | "keyring-pouch"
  | "tee-regular"
  | "tee-oversized"
  | "tee-cropped"
  | "tee-kids";

export type ParameterValue = string | number | boolean;
export type PartShape = "sphere" | "box" | "outline" | "torus" | "cylinder" | "capsule";
export type TemplatePart = {
  name: string;
  kind: string;
  materialSlot: string;
  shape: PartShape;
  width: number;
  height: number;
  depth: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  color?: string;
};
export type Parameter = {
  key: string;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
};
export type MaterialSlot = {
  id: string;
  label: string;
  options: Array<{ value: string; label: string; note: string }>;
};
export type PrintZone = {
  id: string;
  label: string;
  face: "front" | "back";
  widthRatio: number;
  heightRatio: number;
  xRatio: number;
  yRatio: number;
};
export type ProductDefinition = {
  id: TemplateId;
  product: ProductKind;
  label: string;
  description: string;
  dimensions: { width: number; height: number; depth: number };
  dimensionRange: { width: [number, number]; height: [number, number]; depth: [number, number] };
  parameters: Parameter[];
  materialSlots: MaterialSlot[];
  printZones: PrintZone[];
  requiredKinds: string[];
  parts: TemplatePart[];
};
export type ReadinessIssue = {
  code: string;
  level: "error" | "warning" | "info";
  title: string;
  remedy: string;
};
export type ReadinessProject = {
  product: ProductKind;
  templateId: TemplateId;
  width: number;
  height: number;
  depth: number;
  parts: Array<{ kind?: string }>;
  materials: Record<string, string>;
  decals: Array<{ face: "front" | "back"; x: number; y: number; size: number }>;
  assets: Array<{ id: string; width?: number; height?: number }>;
  references: { front?: string; side?: string; back?: string };
  useOutline: boolean;
  front: Array<[number, number]>;
  side: Array<[number, number]>;
};

const fabricOptions = [
  { value: "minky", label: "밍크 원단", note: "짧은 파일의 부드러운 봉제 인형 원단" },
  { value: "velboa", label: "벨보아", note: "선명한 색 표현에 적합한 파일 원단" },
  { value: "canvas", label: "캔버스", note: "형태 유지가 좋은 직물" },
  { value: "cotton", label: "면 저지", note: "티셔츠용 기본 니트 원단" },
  { value: "poly", label: "폴리에스터", note: "전사 인쇄에 적합한 합성 원단" },
];
const hardwareOptions = [
  { value: "nylon", label: "나일론", note: "지퍼·스트랩 기본 소재" },
  { value: "metal", label: "무광 금속", note: "고리·버클·지퍼 풀러용" },
  { value: "cotton", label: "면 테이프", note: "에코백 손잡이와 라벨용" },
];
const palette = { body: "#aec3ad", trim: "#353b42", metal: "#7e857f", accent: "#edd1bd" };
const commonPrintZones: PrintZone[] = [
  { id: "front-main", label: "정면 메인", face: "front", widthRatio: 0.62, heightRatio: 0.42, xRatio: 0, yRatio: 0.05 },
  { id: "back-main", label: "뒷면 메인", face: "back", widthRatio: 0.62, heightRatio: 0.42, xRatio: 0, yRatio: 0.05 },
];

const plushMaterials: MaterialSlot[] = [
  { id: "body", label: "본체 원단", options: fabricOptions.slice(0, 2) },
  { id: "accent", label: "포인트 원단", options: fabricOptions.slice(0, 2) },
  { id: "embroidery", label: "표정·자수", options: [{ value: "embroidery", label: "자수", note: "작은 표정은 자수 권장" }] },
];
const bagMaterials: MaterialSlot[] = [
  { id: "body", label: "본체 원단", options: [fabricOptions[2], fabricOptions[4]] },
  { id: "lining", label: "안감", options: [fabricOptions[4], fabricOptions[3]] },
  { id: "hardware", label: "부자재", options: hardwareOptions },
];
const shirtMaterials: MaterialSlot[] = [
  { id: "body", label: "본체 원단", options: [fabricOptions[3], fabricOptions[4]] },
  { id: "rib", label: "넥 립", options: [fabricOptions[3], fabricOptions[4]] },
  { id: "print", label: "인쇄 방식", options: [
    { value: "dtf", label: "DTF", note: "소량 다색 그래픽에 적합" },
    { value: "screen", label: "실크스크린", note: "대량 단색/별색 인쇄에 적합" },
    { value: "sublimation", label: "전사", note: "폴리에스터 전면 인쇄에 적합" },
  ] },
];

function plushParts(kind: TemplateId): TemplatePart[] {
  const base: TemplatePart[] = [
    { name: "왼쪽 귀", kind: "ear-left", materialSlot: "accent", shape: "sphere", width: 5, height: kind === "rabbit" ? 12 : 5, depth: 3, x: -6, y: 9, z: 0, rotation: kind === "rabbit" ? -12 : 0 },
    { name: "오른쪽 귀", kind: "ear-right", materialSlot: "accent", shape: "sphere", width: 5, height: kind === "rabbit" ? 12 : 5, depth: 3, x: 6, y: 9, z: 0, rotation: kind === "rabbit" ? 12 : 0 },
    { name: "왼쪽 팔", kind: "arm-left", materialSlot: "body", shape: "capsule", width: 3, height: 7, depth: 3, x: -9, y: 0, z: 0, rotation: 15 },
    { name: "오른쪽 팔", kind: "arm-right", materialSlot: "body", shape: "capsule", width: 3, height: 7, depth: 3, x: 9, y: 0, z: 0, rotation: -15 },
    { name: "왼쪽 다리", kind: "leg-left", materialSlot: "body", shape: "sphere", width: 5, height: 6, depth: 5, x: -5, y: -9, z: 1, rotation: 0 },
    { name: "오른쪽 다리", kind: "leg-right", materialSlot: "body", shape: "sphere", width: 5, height: 6, depth: 5, x: 5, y: -9, z: 1, rotation: 0 },
  ];
  if (kind === "cat") base.push({ name: "꼬리", kind: "tail", materialSlot: "body", shape: "capsule", width: 2.2, height: 11, depth: 2.2, x: 8, y: -7, z: -1, rotation: -38 });
  if (kind === "keyring") base.push({ name: "키링 고리", kind: "keyring-loop", materialSlot: "hardware", shape: "torus", width: 3, height: 3, depth: 0.6, x: 0, y: 15, z: 0, rotation: 0, color: palette.metal });
  return base;
}
function bagParts(kind: TemplateId): TemplatePart[] {
  const parts: TemplatePart[] = [
    { name: "상단 지퍼", kind: "zipper", materialSlot: "hardware", shape: "box", width: 25, height: 0.7, depth: 1.2, x: 0, y: 17, z: 5.5, rotation: 0, color: palette.trim },
    { name: "안쪽 포켓", kind: "pocket", materialSlot: "lining", shape: "box", width: 12, height: 8, depth: 0.5, x: 0, y: 1, z: 5.7, rotation: 0, color: palette.accent },
  ];
  if (kind === "tote" || kind === "eco-bag") {
    parts.push(
      { name: "왼쪽 손잡이", kind: "handle-left", materialSlot: "body", shape: "torus", width: 11, height: 11, depth: 1.2, x: -8, y: 22, z: 0, rotation: 0 },
      { name: "오른쪽 손잡이", kind: "handle-right", materialSlot: "body", shape: "torus", width: 11, height: 11, depth: 1.2, x: 8, y: 22, z: 0, rotation: 0 }
    );
  } else if (kind === "backpack") {
    parts.push(
      { name: "왼쪽 어깨끈", kind: "strap-left", materialSlot: "body", shape: "capsule", width: 2.2, height: 27, depth: 1.3, x: -10, y: 0, z: -5.5, rotation: 7 },
      { name: "오른쪽 어깨끈", kind: "strap-right", materialSlot: "body", shape: "capsule", width: 2.2, height: 27, depth: 1.3, x: 10, y: 0, z: -5.5, rotation: -7 },
      { name: "앞주머니", kind: "front-pocket", materialSlot: "body", shape: "box", width: 18, height: 11, depth: 1.4, x: 0, y: -6, z: 5.7, rotation: 0 }
    );
  } else if (kind === "crossbody") {
    parts.push(
      { name: "플랩", kind: "flap", materialSlot: "body", shape: "box", width: 28, height: 12, depth: 1.1, x: 0, y: 11, z: 5.6, rotation: 0 },
      { name: "크로스 스트랩", kind: "strap", materialSlot: "body", shape: "capsule", width: 2, height: 52, depth: 1.2, x: 17, y: 0, z: -2, rotation: -28 },
      { name: "버클", kind: "buckle", materialSlot: "hardware", shape: "torus", width: 3.5, height: 3.5, depth: 0.8, x: 0, y: 3, z: 6.2, rotation: 0, color: palette.metal }
    );
  } else if (kind === "keyring-pouch") {
    parts.push({ name: "카라비너", kind: "keyring-loop", materialSlot: "hardware", shape: "torus", width: 4, height: 4, depth: 0.8, x: 0, y: 15, z: 0, rotation: 0, color: palette.metal });
  } else {
    parts.push({ name: "손목 스트랩", kind: "strap", materialSlot: "body", shape: "capsule", width: 1.6, height: 15, depth: 1, x: 13, y: 10, z: 0, rotation: -22 });
  }
  return parts;
}
function shirtParts(kind: TemplateId): TemplatePart[] {
  const cropped = kind === "tee-cropped";
  return [
    { name: "넥 립", kind: "neck-rib", materialSlot: "rib", shape: "torus", width: 9, height: 4, depth: 0.8, x: 0, y: cropped ? 23 : 29, z: 1.4, rotation: 0, color: palette.trim },
    { name: "왼쪽 소매", kind: "sleeve-left", materialSlot: "body", shape: "capsule", width: 12, height: 19, depth: 2.6, x: -28, y: cropped ? 10 : 17, z: 0, rotation: 35 },
    { name: "오른쪽 소매", kind: "sleeve-right", materialSlot: "body", shape: "capsule", width: 12, height: 19, depth: 2.6, x: 28, y: cropped ? 10 : 17, z: 0, rotation: -35 },
  ];
}

const definitions: ProductDefinition[] = [
  { id: "bear", product: "plush", label: "베이직 베어", description: "좌우 대칭의 기본 봉제 인형", dimensions: { width: 20, height: 23, depth: 15 }, dimensionRange: { width: [8, 45], height: [10, 55], depth: [6, 35] }, parameters: [{ key: "pose", label: "포즈", options: [{ value: "standing", label: "서있음" }, { value: "sitting", label: "앉아있음" }] }], materialSlots: plushMaterials, printZones: commonPrintZones, requiredKinds: ["ear-left", "ear-right", "arm-left", "arm-right", "leg-left", "leg-right"], parts: plushParts("bear") },
  { id: "rabbit", product: "plush", label: "토끼 인형", description: "긴 귀와 부드러운 비율의 인형", dimensions: { width: 20, height: 30, depth: 15 }, dimensionRange: { width: [8, 45], height: [15, 65], depth: [6, 35] }, parameters: [{ key: "earAngle", label: "귀 각도", min: -25, max: 25, step: 1, unit: "°" }], materialSlots: plushMaterials, printZones: commonPrintZones, requiredKinds: ["ear-left", "ear-right", "arm-left", "arm-right", "leg-left", "leg-right"], parts: plushParts("rabbit") },
  { id: "cat", product: "plush", label: "고양이 인형", description: "꼬리와 귀를 갖춘 캐릭터 인형", dimensions: { width: 20, height: 25, depth: 15 }, dimensionRange: { width: [8, 45], height: [12, 55], depth: [6, 35] }, parameters: [{ key: "tailLength", label: "꼬리 길이", min: 5, max: 20, step: 1, unit: "cm" }], materialSlots: plushMaterials, printZones: commonPrintZones, requiredKinds: ["ear-left", "ear-right", "tail"], parts: plushParts("cat") },
  { id: "keyring", product: "plush", label: "키링 인형", description: "휴대용 고리 포함 소형 인형", dimensions: { width: 9, height: 12, depth: 6 }, dimensionRange: { width: [6, 15], height: [8, 18], depth: [3, 10] }, parameters: [{ key: "loopType", label: "고리", options: [{ value: "metal", label: "금속 링" }, { value: "strap", label: "스트랩" }] }], materialSlots: [...plushMaterials, { id: "hardware", label: "고리", options: hardwareOptions }], printZones: commonPrintZones, requiredKinds: ["keyring-loop"], parts: plushParts("keyring") },
  { id: "cushion", product: "plush", label: "쿠션 인형", description: "납작한 전후면 패널형 쿠션", dimensions: { width: 30, height: 30, depth: 10 }, dimensionRange: { width: [15, 60], height: [15, 60], depth: [5, 20] }, parameters: [{ key: "fill", label: "충전감", options: [{ value: "soft", label: "소프트" }, { value: "firm", label: "탄탄함" }] }], materialSlots: plushMaterials, printZones: commonPrintZones, requiredKinds: [], parts: [] },
  { id: "tote", product: "bag", label: "토트백", description: "손잡이와 수납 포켓을 갖춘 구조형 토트", dimensions: { width: 35, height: 38, depth: 10 }, dimensionRange: { width: [20, 55], height: [20, 55], depth: [5, 20] }, parameters: [{ key: "closure", label: "상단 여밈", options: [{ value: "zipper", label: "지퍼" }, { value: "magnet", label: "자석" }, { value: "open", label: "오픈" }] }], materialSlots: bagMaterials, printZones: commonPrintZones, requiredKinds: ["handle-left", "handle-right"], parts: bagParts("tote") },
  { id: "pouch", product: "bag", label: "미니 파우치", description: "지퍼와 손목 스트랩의 소형 파우치", dimensions: { width: 22, height: 15, depth: 5 }, dimensionRange: { width: [10, 35], height: [8, 25], depth: [2, 12] }, parameters: [{ key: "corner", label: "코너 형태", options: [{ value: "round", label: "라운드" }, { value: "square", label: "스퀘어" }] }], materialSlots: bagMaterials, printZones: commonPrintZones, requiredKinds: ["zipper", "strap"], parts: bagParts("pouch") },
  { id: "crossbody", product: "bag", label: "크로스백", description: "플랩과 조절 스트랩이 있는 미니백", dimensions: { width: 30, height: 21, depth: 8 }, dimensionRange: { width: [18, 42], height: [12, 30], depth: [4, 15] }, parameters: [{ key: "strapLength", label: "스트랩 길이", min: 80, max: 140, step: 1, unit: "cm" }], materialSlots: bagMaterials, printZones: commonPrintZones, requiredKinds: ["flap", "strap", "buckle"], parts: bagParts("crossbody") },
  { id: "backpack", product: "bag", label: "백팩", description: "어깨끈과 전면 포켓을 갖춘 데이팩", dimensions: { width: 30, height: 40, depth: 14 }, dimensionRange: { width: [20, 42], height: [25, 55], depth: [8, 22] }, parameters: [{ key: "capacity", label: "수납 용량", options: [{ value: "small", label: "소형" }, { value: "medium", label: "중형" }] }], materialSlots: bagMaterials, printZones: commonPrintZones, requiredKinds: ["strap-left", "strap-right", "front-pocket"], parts: bagParts("backpack") },
  { id: "eco-bag", product: "bag", label: "에코백", description: "평면 패널과 면 테이프 손잡이의 데일리백", dimensions: { width: 36, height: 40, depth: 4 }, dimensionRange: { width: [25, 50], height: [25, 55], depth: [1, 10] }, parameters: [{ key: "gusset", label: "바닥 거싯", options: [{ value: "flat", label: "없음" }, { value: "bottom", label: "바닥 거싯" }] }], materialSlots: bagMaterials, printZones: commonPrintZones, requiredKinds: ["handle-left", "handle-right"], parts: bagParts("eco-bag") },
  { id: "keyring-pouch", product: "bag", label: "키링 파우치", description: "소형 파우치와 카라비너 고리", dimensions: { width: 12, height: 12, depth: 4 }, dimensionRange: { width: [7, 18], height: [7, 18], depth: [2, 8] }, parameters: [{ key: "ring", label: "고리", options: [{ value: "carabiner", label: "카라비너" }, { value: "ring", label: "링" }] }], materialSlots: bagMaterials, printZones: commonPrintZones, requiredKinds: ["keyring-loop", "zipper"], parts: bagParts("keyring-pouch") },
  { id: "tee-regular", product: "shirt", label: "레귤러 티셔츠", description: "기본 반팔 핏과 앞·뒤 인쇄 영역", dimensions: { width: 55, height: 70, depth: 2 }, dimensionRange: { width: [40, 80], height: [50, 90], depth: [1, 5] }, parameters: [{ key: "size", label: "사이즈", options: ["S", "M", "L", "XL", "2XL"].map(value => ({ value, label: value })) }], materialSlots: shirtMaterials, printZones: commonPrintZones, requiredKinds: ["neck-rib", "sleeve-left", "sleeve-right"], parts: shirtParts("tee-regular") },
  { id: "tee-oversized", product: "shirt", label: "오버사이즈 티셔츠", description: "넓은 품과 긴 소매의 루즈핏", dimensions: { width: 66, height: 76, depth: 2.5 }, dimensionRange: { width: [50, 95], height: [55, 100], depth: [1, 6] }, parameters: [{ key: "size", label: "사이즈", options: ["M", "L", "XL", "2XL"].map(value => ({ value, label: value })) }], materialSlots: shirtMaterials, printZones: commonPrintZones, requiredKinds: ["neck-rib", "sleeve-left", "sleeve-right"], parts: shirtParts("tee-oversized") },
  { id: "tee-cropped", product: "shirt", label: "크롭 티셔츠", description: "짧은 총장과 기본 반팔 실루엣", dimensions: { width: 50, height: 48, depth: 2 }, dimensionRange: { width: [38, 70], height: [35, 65], depth: [1, 5] }, parameters: [{ key: "size", label: "사이즈", options: ["XS", "S", "M", "L"].map(value => ({ value, label: value })) }], materialSlots: shirtMaterials, printZones: commonPrintZones, requiredKinds: ["neck-rib", "sleeve-left", "sleeve-right"], parts: shirtParts("tee-cropped") },
  { id: "tee-kids", product: "shirt", label: "키즈 티셔츠", description: "어린이 치수 범위에 맞춘 반팔", dimensions: { width: 38, height: 48, depth: 1.8 }, dimensionRange: { width: [28, 50], height: [35, 65], depth: [1, 4] }, parameters: [{ key: "size", label: "사이즈", options: ["90", "100", "110", "120", "130"].map(value => ({ value, label: value })) }], materialSlots: shirtMaterials, printZones: commonPrintZones, requiredKinds: ["neck-rib", "sleeve-left", "sleeve-right"], parts: shirtParts("tee-kids") },
];

export const templateIds = definitions.map(definition => definition.id) as TemplateId[];
export function getTemplate(id: TemplateId) {
  const definition = definitions.find(item => item.id === id);
  if (!definition) throw Error("제품 템플릿을 찾지 못했습니다.");
  return definition;
}
export function templatesFor(product: ProductKind) {
  return definitions.filter(item => item.product === product);
}
export function defaultTemplateForProduct(product: ProductKind): TemplateId {
  return templatesFor(product)[0]!.id;
}
export function parameterDefaults(templateId: TemplateId): Record<string, ParameterValue> {
  return Object.fromEntries(getTemplate(templateId).parameters.map(parameter => [parameter.key, parameter.options?.[0]?.value ?? parameter.min ?? 0]));
}
export function materialDefaults(templateId: TemplateId): Record<string, string> {
  return Object.fromEntries(getTemplate(templateId).materialSlots.map(slot => [slot.id, slot.options[0]!.value]));
}
export function templateParts(templateId: TemplateId, bodyColor: string) {
  return getTemplate(templateId).parts.map(part => ({ ...part, color: part.color ?? bodyColor }));
}
export function materialAppearance(value: string | undefined) {
  if (value === "metal") return { roughness: 0.32, metalness: 0.72 };
  if (value === "canvas") return { roughness: 0.92, metalness: 0 };
  if (value === "minky" || value === "velboa") return { roughness: 0.72, metalness: 0 };
  if (value === "cotton") return { roughness: 0.86, metalness: 0 };
  return { roughness: 0.64, metalness: 0 };
}
export function resolveTemplateParts<T extends { kind?: string; name: string; width: number; height: number; rotation: number; y: number }>(project: {
  templateId: TemplateId;
  parameters: Record<string, ParameterValue>;
  parts: T[];
}): T[] {
  const earAngle = Number(project.parameters.earAngle ?? 0);
  const tailLength = Number(project.parameters.tailLength ?? 11);
  const strapLength = Number(project.parameters.strapLength ?? 110);
  const capacity = project.parameters.capacity;
  const pose = project.parameters.pose;
  const closure = project.parameters.closure;
  return project.parts.filter(part => !(part.kind === "zipper" && closure === "open")).map(part => {
    if (part.kind === "ear-left" || part.kind === "ear-right") {
      const direction = part.kind === "ear-left" ? -1 : 1;
      return { ...part, rotation: part.rotation + direction * earAngle } as T;
    }
    if (part.kind === "tail") return { ...part, height: tailLength } as T;
    if (part.kind === "strap" && project.templateId === "crossbody") {
      return { ...part, height: Math.max(28, Math.min(58, strapLength * 0.42)) } as T;
    }
    if (part.kind === "front-pocket" && capacity === "medium") {
      return { ...part, width: part.width * 1.16, height: part.height * 1.18 } as T;
    }
    if (part.kind === "zipper" && closure === "magnet") {
      return { ...part, name: "자석 여밈", width: Math.min(5, part.width), height: 1.1 } as T;
    }
    if ((part.kind === "leg-left" || part.kind === "leg-right") && pose === "sitting") {
      return { ...part, y: part.y + 3.2 } as T;
    }
    return part;
  });
}
export function getPrintZones(project: Pick<ReadinessProject, "templateId" | "width" | "height">) {
  return getTemplate(project.templateId).printZones.map(zone => ({
    ...zone,
    width: Number((project.width * zone.widthRatio).toFixed(1)),
    height: Number((project.height * zone.heightRatio).toFixed(1)),
    x: Number((project.width * zone.xRatio).toFixed(1)),
    y: Number((project.height * zone.yRatio).toFixed(1)),
  }));
}
export function requiredViewsFor(product: ProductKind): Array<"front" | "side" | "back"> {
  if (product === "bag") return ["front", "side", "back"];
  if (product === "shirt") return ["front", "back"];
  return ["front", "side"];
}
function outlineArea(points: Array<[number, number]>) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;
}
export function validateDesignReadiness(project: ReadinessProject): ReadinessIssue[] {
  const definition = getTemplate(project.templateId);
  const issues: ReadinessIssue[] = [];
  (["width", "height", "depth"] as const).forEach(axis => {
    const [min, max] = definition.dimensionRange[axis];
    if (project[axis] < min || project[axis] > max) issues.push({ code: `dimension-${axis}`, level: "error", title: `${axis === "width" ? "가로" : axis === "height" ? "세로" : "두께"}가 템플릿 범위를 벗어났습니다.`, remedy: `${min}~${max}cm 안에서 조절하거나 전문가 검토를 요청하세요.` });
  });
  const partKinds = new Set(project.parts.map(part => part.kind));
  definition.requiredKinds.filter(kind => !partKinds.has(kind)).forEach(kind => issues.push({ code: `part-${kind}`, level: "error", title: "필수 구조 부위가 빠져 있습니다.", remedy: `${kind} 부위를 템플릿 기본값으로 복원하세요.` }));
  definition.materialSlots.filter(slot => !project.materials[slot.id]).forEach(slot => issues.push({ code: `material-${slot.id}`, level: "error", title: `${slot.label} 선택이 필요합니다.`, remedy: "제품 표면과 제작 조건을 확인한 뒤 소재를 선택하세요." }));
  requiredViewsFor(project.product).forEach(view => {
    if (!project.references[view]) issues.push({ code: `required-view-${view}`, level: "error", title: `${view === "front" ? "정면" : view === "side" ? "옆면" : "뒷면"} 참조 이미지가 필요합니다.`, remedy: "제품 전체가 보이는 단색 배경 이미지를 해당 면에 업로드하세요." });
  });
  if (project.useOutline) {
    const outlineInputs: Array<["front" | "side", Array<[number, number]>]> = [["front", project.front], ["side", project.side]];
    outlineInputs.forEach(([view, points]) => {
      if (points.length > 0 && (points.length < 3 || outlineArea(points) < 0.005)) issues.push({ code: `outline-${view}`, level: "error", title: `${view === "front" ? "정면" : "옆면"} 윤곽이 형상을 만들기에 불충분합니다.`, remedy: "점 3개 이상으로 닫힌 외곽선을 만들고 너무 작은 윤곽은 다시 지정하세요." });
    });
    if (project.front.length < 3) issues.push({ code: "outline-front-required", level: "error", title: "사용자 윤곽 모드에는 정면 윤곽이 필요합니다.", remedy: "정면 이미지 위에서 본체 외곽을 닫힌 선으로 지정하세요." });
  }
  const zones = getPrintZones(project);
  project.decals.forEach((decal, index) => {
    const zone = zones.find(item => item.face === decal.face);
    if (!zone) issues.push({ code: `print-face-${index}`, level: "error", title: "선택한 면에는 인쇄 영역이 없습니다.", remedy: "정면 또는 뒷면의 허용 영역으로 이동하세요." });
    else if (Math.abs(decal.x - zone.x) + decal.size / 2 > zone.width / 2 || Math.abs(decal.y - zone.y) + decal.size / 2 > zone.height / 2) issues.push({ code: `print-zone-${index}`, level: "error", title: "그래픽이 인쇄 안전 영역을 벗어났습니다.", remedy: `${zone.label} ${zone.width} × ${zone.height}cm 안에 배치하세요.` });
    else if (decal.size > 20) issues.push({ code: `print-dpi-${index}`, level: "warning", title: "큰 그래픽은 원본 해상도 검토가 필요합니다.", remedy: "최종 인쇄 크기에서 150dpi 이상의 원본 PNG 또는 SVG를 사용하세요." });
    const asset = project.assets[index];
    const requiredPixels = (decal.size / 2.54) * 150;
    if (!asset?.width || !asset?.height)
      issues.push({ code: `print-resolution-${index}`, level: "warning", title: "그래픽 원본의 픽셀 정보를 확인할 수 없습니다.", remedy: "원본 PNG 또는 SVG를 다시 첨부해 150dpi 기준을 확인하세요." });
    else if (Math.min(asset.width, asset.height) < requiredPixels)
      issues.push({ code: `print-resolution-${index}`, level: "error", title: "그래픽 해상도가 선택한 인쇄 크기에 부족합니다.", remedy: `짧은 변이 최소 ${Math.ceil(requiredPixels)}px 이상인 원본을 사용하거나 인쇄 크기를 줄이세요.` });
  });
  return issues;
}
