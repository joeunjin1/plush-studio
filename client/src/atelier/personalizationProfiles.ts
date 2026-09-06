export type PersonalizationMethod =
  | "memorial_tag"
  | "screen_print"
  | "heat_transfer"
  | "embroidery"
  | "woven_label"
  | "patch";

export type PersonalizationInputMode = "text" | "image" | "text_or_image";

export type PersonalizationProfile = {
  id: string;
  code: string;
  label: string;
  method: PersonalizationMethod;
  inputMode: PersonalizationInputMode;
  supportedFamilies: Array<"plush" | "bag" | "shirt">;
  description: string;
  constraints: {
    maxCharacters?: number;
    maxLines?: number;
    acceptedMimeTypes?: string[];
    maximumFileMegabytes?: number;
    safeAreaLabel: string;
  };
  factoryReviewNote: string;
};

export const personalizationProfiles: PersonalizationProfile[] = [
  {
    id: "memorial-tag-text-v01",
    code: "MEMORIAL_TAG_TEXT_V01",
    label: "교체형 기념택 문구",
    method: "memorial_tag",
    inputMode: "text",
    supportedFamilies: ["plush", "bag"],
    description: "교체형 택의 선택한 면에 추모·기념 문구를 넣습니다.",
    constraints: { maxCharacters: 36, maxLines: 3, safeAreaLabel: "택 전면 안전 영역" },
    factoryReviewNote: "택 소재, 서체, 줄바꿈, 타공 위치는 샘플 승인 단계에서 확정합니다.",
  },
  {
    id: "memorial-tag-brand-v01",
    code: "MEMORIAL_TAG_BRAND_V01",
    label: "브랜드 마크 기념택",
    method: "memorial_tag",
    inputMode: "image",
    supportedFamilies: ["plush", "bag"],
    description: "승인 전 브랜드 마크 이미지를 교체형 택의 안전 영역에 배치합니다.",
    constraints: {
      acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      maximumFileMegabytes: 5,
      safeAreaLabel: "택 전면 안전 영역",
    },
    factoryReviewNote: "브랜드 사용권, 인쇄 방식, 최소 선폭, 색상과 최종 크기는 제작 승인 후 확정합니다.",
  },
  {
    id: "front-screen-print-v01",
    code: "FRONT_SCREEN_PRINT_V01",
    label: "전면 실크스크린 인쇄",
    method: "screen_print",
    inputMode: "image",
    supportedFamilies: ["plush", "bag", "shirt"],
    description: "승인된 단색 또는 별색 아트워크를 전면 안전 영역에 인쇄합니다.",
    constraints: {
      acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      maximumFileMegabytes: 5,
      safeAreaLabel: "전면 인쇄 안전 영역",
    },
    factoryReviewNote: "원본 벡터 파일, 인쇄 색상, 판수 및 원단 적합성은 견적·샘플 단계에서 검토합니다.",
  },
  {
    id: "front-embroidery-v01",
    code: "FRONT_EMBROIDERY_V01",
    label: "전면 자수",
    method: "embroidery",
    inputMode: "text_or_image",
    supportedFamilies: ["plush", "bag", "shirt"],
    description: "문구 또는 로고를 자수로 적용합니다.",
    constraints: {
      maxCharacters: 18,
      maxLines: 2,
      acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      maximumFileMegabytes: 5,
      safeAreaLabel: "자수 가능 안전 영역",
    },
    factoryReviewNote: "자수 파일 펀칭, 실 색상, 최소 선폭, 원단 수축은 공장 검토 후 확정합니다.",
  },
];

export const bernesePersonalizationProfileIds = [
  "memorial-tag-text-v01",
  "memorial-tag-brand-v01",
] as const;

export function profilesForReferenceProduct(productFamily: "plush" | "bag" | "shirt", profileIds?: readonly string[]) {
  const allowed = profileIds ? new Set(profileIds) : null;
  return personalizationProfiles.filter(
    profile =>
      profile.supportedFamilies.includes(productFamily) &&
      (!allowed || allowed.has(profile.id))
  );
}

export function constrainPersonalizationText(
  value: string,
  constraints: PersonalizationProfile["constraints"]
) {
  const lines = value.replace(/\r/g, "").split("\n");
  const limitedLines = lines.slice(0, constraints.maxLines ?? lines.length).join("\n");
  return limitedLines.slice(0, constraints.maxCharacters ?? limitedLines.length);
}

export function validatePersonalizationFile(
  file: Pick<File, "type" | "size">,
  constraints: PersonalizationProfile["constraints"]
) {
  if (constraints.acceptedMimeTypes && !constraints.acceptedMimeTypes.includes(file.type)) {
    return "PNG, JPG 또는 WebP 이미지만 올릴 수 있습니다.";
  }
  if (
    constraints.maximumFileMegabytes &&
    file.size > constraints.maximumFileMegabytes * 1024 * 1024
  ) {
    return `이미지는 ${constraints.maximumFileMegabytes}MB 이하로 올려 주세요.`;
  }
  return null;
}
