export const requiredReferencePhotoViews = [
  "front",
  "left",
  "rear",
  "right",
  "top",
] as const;

export type ReferencePhotoViewKey = (typeof requiredReferencePhotoViews)[number];

export const referencePhotoViewLabels: Record<ReferencePhotoViewKey, string> = {
  front: "정면",
  left: "좌측면",
  rear: "뒷면",
  right: "우측면",
  top: "윗면",
};

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const filenamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/;
export const referencePhotoMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
export const referencePhotoMaxBytes = 10 * 1024 * 1024;

export type ReferencePhotoAnalysis = {
  byteSize: number;
  pixelWidth: number;
  pixelHeight: number;
};

export function validateReferencePhotoFile(file: File) {
  if (!referencePhotoMimeTypes.includes(file.type as (typeof referencePhotoMimeTypes)[number])) {
    throw new Error("PNG, JPG 또는 WebP 사진만 등록할 수 있습니다.");
  }
  if (file.size <= 0 || file.size > referencePhotoMaxBytes) {
    throw new Error("사진은 파일당 10MB 이하로 등록해 주세요.");
  }
  if (!filenamePattern.test(file.name)) {
    throw new Error("파일명은 영문·숫자·점·밑줄·하이픈만 사용할 수 있습니다.");
  }
}

export function referencePhotoStoragePath(
  organizationId: string,
  productId: string,
  viewKey: ReferencePhotoViewKey,
  filename: string
) {
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(productId)) {
    throw new Error("조직 또는 상품 식별자가 올바르지 않습니다.");
  }
  if (!filenamePattern.test(filename)) {
    throw new Error("사진 파일명이 올바르지 않습니다.");
  }
  return `${organizationId}/reference-products/${productId}/images/${viewKey}/${filename}`;
}

export async function analyzeReferencePhoto(file: File): Promise<ReferencePhotoAnalysis> {
  validateReferencePhotoFile(file);
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("사진의 픽셀 정보를 읽지 못했습니다."));
      image.src = objectUrl;
    });
    if (dimensions.width < 320 || dimensions.height < 320 || dimensions.width > 10_000 || dimensions.height > 10_000) {
      throw new Error("사진은 가로·세로 각각 320~10,000px 범위여야 합니다.");
    }
    return { byteSize: file.size, pixelWidth: dimensions.width, pixelHeight: dimensions.height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function hasCompleteRequiredReferencePhotoSet(
  files: Partial<Record<ReferencePhotoViewKey, File>>
) {
  return requiredReferencePhotoViews.every(view => files[view] instanceof File);
}
