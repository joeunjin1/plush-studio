export const ownerGlbMimeType = "model/gltf-binary";
export const ownerGlbMaxBytes = 200 * 1024 * 1024;
export const ownerGlbRecommendedBytes = 8 * 1024 * 1024;
export const ownerGlbRecommendedTriangles = 75_000;

type GlbAccessor = { count?: number };
type GlbPrimitive = { attributes?: { POSITION?: number }; indices?: number; mode?: number };
type GlbMesh = { primitives?: GlbPrimitive[] };
type GlbDocument = {
  accessors?: GlbAccessor[];
  meshes?: GlbMesh[];
  materials?: unknown[];
  images?: unknown[];
  animations?: unknown[];
};

export type OwnerGlbAnalysis = {
  meshCount: number;
  triangleCount: number;
  materialCount: number;
  embeddedTextureCount: number;
  hasAnimations: boolean;
};

function glbTriangleCount(document: GlbDocument) {
  return (document.meshes ?? []).reduce((total, mesh) => {
    return total + (mesh.primitives ?? []).reduce((meshTotal, primitive) => {
      const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
      const count = accessorIndex === undefined ? 0 : document.accessors?.[accessorIndex]?.count ?? 0;
      const mode = primitive.mode ?? 4;
      if (mode === 4) return meshTotal + Math.floor(count / 3);
      if (mode === 5 || mode === 6) return meshTotal + Math.max(0, count - 2);
      return meshTotal;
    }, 0);
  }, 0);
}

export function analyzeOwnerGlb(bytes: ArrayBuffer): OwnerGlbAnalysis {
  if (bytes.byteLength < 20) throw new Error("GLB 헤더를 읽을 수 없습니다.");
  const view = new DataView(bytes);
  const glbMagic = 0x46546c67;
  const jsonChunkType = 0x4e4f534a;
  if (view.getUint32(0, true) !== glbMagic || view.getUint32(4, true) !== 2) {
    throw new Error("GLB 2.0 형식 파일만 등록할 수 있습니다.");
  }
  if (view.getUint32(8, true) !== bytes.byteLength) throw new Error("GLB 파일 길이가 일치하지 않습니다.");
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== jsonChunkType || jsonLength + 20 > bytes.byteLength) {
    throw new Error("GLB JSON 정보를 읽을 수 없습니다.");
  }
  let document: GlbDocument;
  try {
    const json = new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength)).replace(/\0+$/g, "");
    document = JSON.parse(json) as GlbDocument;
  } catch {
    throw new Error("GLB JSON 정보를 해석할 수 없습니다.");
  }
  return {
    meshCount: document.meshes?.length ?? 0,
    triangleCount: glbTriangleCount(document),
    materialCount: document.materials?.length ?? 0,
    embeddedTextureCount: document.images?.length ?? 0,
    hasAnimations: (document.animations?.length ?? 0) > 0,
  };
}

export async function sha256ForBytes(bytes: ArrayBuffer) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256ForFile(file: File) {
  return sha256ForBytes(await file.arrayBuffer());
}

function sanitizedFilename(filename: string) {
  const clean = filename.trim().replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-");
  if (!clean || clean === "." || clean === "..") throw new Error("안전한 영문 파일명을 사용해 주세요.");
  return clean;
}

export function ownerModelStoragePath(organizationId: string, version: string, filename: string) {
  const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
  const safeVersion = version.trim();
  if (!uuid.test(organizationId)) throw new Error("조직 식별자가 올바르지 않습니다.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(safeVersion)) {
    throw new Error("모델 버전은 영문·숫자·점·밑줄·하이픈으로 40자 이내여야 합니다.");
  }
  return `${organizationId}/reference-products/models/${safeVersion}/${sanitizedFilename(filename)}`;
}

export function validateOwnerGlbFile(file: File) {
  const isGlbName = file.name.toLowerCase().endsWith(".glb");
  if (!isGlbName || (file.type && file.type !== ownerGlbMimeType)) {
    throw new Error("GLB(.glb) 파일만 등록할 수 있습니다.");
  }
  if (file.size === 0 || file.size > ownerGlbMaxBytes) {
    throw new Error("GLB 파일은 0보다 크고 200MB 이하여야 합니다.");
  }
}

export function ownerGlbPerformanceMessage(file: File, analysis: OwnerGlbAnalysis) {
  if (file.size > ownerGlbRecommendedBytes || analysis.triangleCount > ownerGlbRecommendedTriangles) {
    return "모바일 권장 예산(8MB·75,000 triangles)을 초과합니다. 5면 사진 폴백을 유지하고 실제 기기 성능 검토 후 공개하세요.";
  }
  return "권장 모바일 예산 안입니다. 실제 기기·네트워크 확인과 5면 사진 비교는 공개 전에도 필요합니다.";
}
