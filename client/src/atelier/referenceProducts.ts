export const referenceViewIds = ["front", "left", "rear", "right", "top"] as const;
export type ReferenceViewId = (typeof referenceViewIds)[number];
export type MemorialTagSide = "front" | "back";

const catalogBucket = "plush-studio-catalog";

function catalogImage(filename: string, developmentFallback: string, stagingFilename = filename) {
  if (import.meta.env.DEV) return developmentFallback;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const file = supabaseUrl?.includes("trhhgmionyyfnbwhxenn") ? stagingFilename : filename;
  return supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/${catalogBucket}/${file}`
    : developmentFallback;
}

function stagingCatalogModel(filename: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  return supabaseUrl?.includes("trhhgmionyyfnbwhxenn")
    ? `${supabaseUrl}/storage/v1/object/public/${catalogBucket}/${filename}`
    : undefined;
}

export type ReferenceProduct = {
  id: string;
  sku: string;
  title: string;
  family: "plush" | "bag" | "shirt";
  colorLabel: string;
  sourceStatus: "seller-supplied" | "reviewed";
  reviewLabel: string;
  personalizationProfileIds: string[];
  model3d?: { label: string; source: string; version: string; checksumSha256: string };
  views: Record<ReferenceViewId, { label: string; image: string }>;
  memorialTag: {
    enabled: boolean;
    maxCharacters: number;
    maxLines: number;
    sides: Record<MemorialTagSide, { label: string; image: string }>;
  };
  physicalDimensions?: { widthCm: number; heightCm: number; depthCm: number };
  carton?: { widthCm: number; heightCm: number; depthCm: number };
};

export const referenceProducts: ReferenceProduct[] = [
  {
    id: "bernese-memorial-plush-v01",
    sku: "PS-BERNESE-MEMORIAL-001",
    title: "버니즈 기념 독 인형",
    family: "plush",
    colorLabel: "블랙 · 화이트 · 브라운",
    sourceStatus: "seller-supplied",
    reviewLabel: "대표 제공 5면 기준 이미지 · 치수/포장 실측 등록 전",
    personalizationProfileIds: ["memorial-tag-text-v01", "memorial-tag-brand-v01"],
    model3d: (() => {
      const source = stagingCatalogModel("bernese-memorial-plush/3d/berner_plush_360_v02.glb");
      return source
        ? {
            label: "대표 제공 GLB 3D 제품 뷰",
            source,
            version: "v02",
            checksumSha256: "eeebf4aba5861150ae0eca006cf85bb7d0583e7b9400c15ff60ac2106ac647d5",
          }
        : undefined;
    })(),
    views: {
      front: {
        label: "정면",
        image: catalogImage("bernese-memorial-plush__front__v01.webp", "/manus-storage/bernese-memorial-plush__front__v01_9bec9492.webp"),
      },
      left: {
        label: "좌측면",
        image: catalogImage("bernese-memorial-plush__left__v01.webp", "/manus-storage/bernese-memorial-plush__left__v01_81485ddc.webp"),
      },
      rear: {
        label: "뒷면",
        image: catalogImage(
          "bernese-memorial-plush__rear__v01.webp",
          "/manus-storage/bernese-memorial-plush__rear__v01_ba0a97e4.webp",
          "pasted_file_HSmHMI_image.png"
        ),
      },
      right: {
        label: "우측면",
        image: catalogImage("bernese-memorial-plush__right__v01.webp", "/manus-storage/bernese-memorial-plush__right__v01_c124b4f3.webp"),
      },
      top: {
        label: "윗면",
        image: catalogImage(
          "bernese-memorial-plush__top__v01.webp",
          "/manus-storage/bernese-memorial-plush__top__v01_92149030.webp",
          "pasted_file_mjsXem_image.png"
        ),
      },
    },
    memorialTag: {
      enabled: true,
      maxCharacters: 36,
      maxLines: 3,
      sides: {
        front: {
          label: "기념택 앞면",
          image: catalogImage("bernese-memorial-tag__front__v01.webp", "/manus-storage/bernese-memorial-tag__front__v01_43178df8.webp"),
        },
        back: {
          label: "기념택 뒷면",
          image: catalogImage("bernese-memorial-tag__back__v01.webp", "/manus-storage/bernese-memorial-tag__back__v01_25969fb6.webp"),
        },
      },
    },
  },
];

export function referenceProductById(id: string | null) {
  return referenceProducts.find(product => product.id === id) ?? null;
}

export function calculateCartonCbm(carton?: ReferenceProduct["carton"]) {
  if (!carton) return null;
  return (carton.widthCm * carton.heightCm * carton.depthCm) / 1_000_000;
}

export function constrainMemorialMessage(
  value: string,
  maxCharacters: number,
  maxLines: number
) {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .slice(0, maxLines)
    .join("\n")
    .slice(0, maxCharacters);
}
