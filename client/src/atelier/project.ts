import { z } from "zod";
import { newRequestId } from "@/lib/requestId";
import {
  defaultTemplateForProduct,
  getTemplate,
  materialDefaults,
  parameterDefaults,
  templateIds,
  templateParts,
  type TemplateId,
} from "./productDefinition";
const id = z.string().uuid(),
  point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
  color = z.string().regex(/^#[a-f0-9]{6}$/i);
const dimension = z.number().min(0.1).max(200);
export const partSchema = z.object({
  id,
  name: z.string().min(1).max(60),
  shape: z.enum(["sphere", "box", "outline", "torus", "cylinder", "capsule"]),
  color,
  width: dimension,
  height: dimension,
  depth: dimension,
  x: z.number().min(-200).max(200),
  y: z.number().min(-200).max(200),
  z: z.number().min(-200).max(200),
  rotation: z.number().min(-180).max(180),
  group: z.string().max(40).optional(),
  kind: z.string().max(60).optional(),
  materialSlot: z.string().max(40).optional(),
  front: z.array(point).max(128).default([]),
  side: z.array(point).max(128).default([]),
});
export const assetSchema = z.object({
  id,
  name: z.string().max(255),
  data: z
    .string()
    .max(3000000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  path: z
    .string()
    .regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/)
    .optional(),
  width: z.number().int().min(1).max(1200).optional(),
  height: z.number().int().min(1).max(1200).optional(),
});
export const projectSchema = z.object({
  version: z.literal(1),
  id,
  name: z.string().trim().min(1).max(100),
  product: z.enum(["plush", "bag", "shirt"]),
  templateId: z.enum(templateIds as [TemplateId, ...TemplateId[]]).optional(),
  parameters: z.record(z.string(), z.union([z.string().max(40), z.number().finite().min(-500).max(500), z.boolean()])).default({}),
  materials: z.record(z.string(), z.string().min(1).max(40)).default({}),
  color,
  width: dimension,
  height: dimension,
  depth: dimension,
  front: z.array(point).max(128),
  side: z.array(point).max(128),
  useOutline: z.boolean(),
  references: z.object({
    front: id.optional(),
    side: id.optional(),
    back: id.optional(),
  }),
  assets: z.array(assetSchema).max(12),
  decals: z
    .array(
      z.object({
        id,
        assetId: id,
        face: z.enum(["front", "back"]),
        x: z.number().min(-100).max(100),
        y: z.number().min(-100).max(100),
        size: z.number().min(0.5).max(100),
        rotation: z.number().min(-180).max(180),
      })
    )
    .max(6),
  parts: z.array(partSchema).max(12),
  notes: z.string().max(3000),
  updatedAt: z.string(),
  revision: z.number().int().min(0),
  cloudOwner: id.optional(),
});
export type Project = z.infer<typeof projectSchema>;
export type Part = z.infer<typeof partSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Point = [number, number];
export const productNames = { plush: "인형", bag: "가방", shirt: "티셔츠" };
export const outlines: Record<Project["product"], Point[]> = {
  plush: [
    [0.5, 0.03],
    [0.72, 0.06],
    [0.86, 0.2],
    [0.84, 0.4],
    [0.72, 0.52],
    [0.83, 0.67],
    [0.78, 0.96],
    [0.22, 0.96],
    [0.17, 0.67],
    [0.28, 0.52],
    [0.16, 0.4],
    [0.14, 0.2],
    [0.28, 0.06],
  ],
  bag: [
    [0.08, 0.08],
    [0.92, 0.08],
    [0.95, 0.96],
    [0.05, 0.96],
  ],
  shirt: [
    [0.32, 0.08],
    [0.41, 0.13],
    [0.59, 0.13],
    [0.68, 0.08],
    [0.98, 0.28],
    [0.84, 0.43],
    [0.72, 0.35],
    [0.72, 0.96],
    [0.28, 0.96],
    [0.28, 0.35],
    [0.16, 0.43],
    [0.02, 0.28],
  ],
};
export function createProjectFromTemplate(templateId: TemplateId): Project {
  const template = getTemplate(templateId),
    product = template.product,
    color = "#aec3ad";
  return {
    version: 1,
    id: newRequestId(),
    name: `새 ${template.label} 디자인`,
    product,
    templateId,
    parameters: parameterDefaults(templateId),
    materials: materialDefaults(templateId),
    color,
    width: template.dimensions.width,
    height: template.dimensions.height,
    depth: template.dimensions.depth,
    front: [],
    side: [],
    useOutline: false,
    references: {},
    assets: [],
    decals: [],
    parts: templateParts(templateId, color).map(part => ({ ...part, id: newRequestId(), front: [], side: [] })),
    notes: "",
    updatedAt: new Date().toISOString(),
    revision: 0,
  };
}
export function createProject(product: Project["product"] = "plush"): Project {
  return createProjectFromTemplate(defaultTemplateForProduct(product));
}
export function validateOutline(points: Point[]) {
  if (points.length < 3) throw Error("윤곽선을 3개 이상의 점으로 그려 주세요.");
  const area =
    Math.abs(
      points.reduce((s, p, i) => {
        const q = points[(i + 1) % points.length];
        return s + p[0] * q[1] - q[0] * p[1];
      }, 0)
    ) / 2;
  if (area < 0.005) throw Error("윤곽선 면적이 너무 작거나 선이 겹쳤습니다.");
  const cross = (a: Point, b: Point, c: Point) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < points.length; i++)
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      const a = points[i],
        b = points[(i + 1) % points.length],
        c = points[j],
        d = points[(j + 1) % points.length];
      if (
        cross(a, b, c) * cross(a, b, d) < 0 &&
        cross(c, d, a) * cross(c, d, b) < 0
      )
        throw Error("윤곽선이 교차합니다. 마지막 점을 되돌려 주세요.");
    }
}
export function parseProject(raw: unknown) {
  const parsed = projectSchema.parse(raw);
  const fallback = defaultTemplateForProduct(parsed.product),
    requestedTemplate = parsed.templateId ?? fallback,
    templateId = getTemplate(requestedTemplate).product === parsed.product ? requestedTemplate : fallback,
    p: Project = {
      ...parsed,
      templateId,
      parameters: { ...parameterDefaults(templateId), ...parsed.parameters },
      materials: { ...materialDefaults(templateId), ...parsed.materials },
    };
  const ids = new Set(p.assets.map(a => a.id));
  if (
    ids.size !== p.assets.length ||
    new Set(p.parts.map(a => a.id)).size !== p.parts.length
  )
    throw Error("중복된 파일 또는 부위 ID입니다.");
  for (const a of Object.values(p.references))
    if (a && !ids.has(a)) throw Error("참고 이미지가 빠져 있습니다.");
  for (const d of p.decals)
    if (!ids.has(d.assetId)) throw Error("디자인 이미지가 빠져 있습니다.");
  if (p.useOutline) validateOutline(p.front);
  for (const part of p.parts)
    if (part.shape === "outline") validateOutline(part.front);
  return p;
}
export function localCopy(p: Project) {
  return {
    ...p,
    id: newRequestId(),
    revision: 0,
    cloudOwner: undefined,
    updatedAt: new Date().toISOString(),
  };
}
