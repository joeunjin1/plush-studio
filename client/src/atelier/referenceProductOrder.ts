import { z } from "zod";
import { supabase } from "@/lib/supabase";
import type { ReferenceProduct } from "./referenceProducts";
import type { PersonalizationProfile } from "./personalizationProfiles";

export const referenceOrderPurposeOptions = [
  ["sample", "샘플 확인 후 진행"],
  ["production", "수량 제작 상담"],
  ["consult", "사양·제작 가능 여부 상담"],
] as const;

export const referenceProductOrderDraftSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().min(3).max(120),
  personalizationProfileId: z.string().max(80),
  personalizationText: z.string().max(500),
  personalizationArtwork: z
    .object({
      dataUrl: z.string().startsWith("data:image/"),
      name: z.string().min(1).max(255),
      mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
      byteSize: z.number().int().min(1).max(5 * 1024 * 1024),
    })
    .nullable(),
  placementLabel: z.string().max(160),
  companyName: z.string().max(160),
  contactName: z.string().max(80),
  contactPhone: z
    .string()
    .trim()
    .max(30)
    .refine(value => !value || /^[+\d() -]{7,30}$/.test(value), "전화번호 형식을 확인해 주세요."),
  quantity: z.number().int().min(1).max(100000),
  desiredDeliveryDate: z.string().max(10),
  purpose: z.enum(["sample", "production", "consult"]),
  orderNote: z.string().max(3000),
  consent: z.boolean(),
});

export type ReferenceProductOrderDraft = z.infer<typeof referenceProductOrderDraftSchema>;

export const referenceProductOrderSubmissionSchema = referenceProductOrderDraftSchema.extend({
  personalizationProfileId: z.string().min(3).max(80),
  companyName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(80),
  consent: z.literal(true),
});

const referenceProductOrderDraftStorageKey = "plush-studio-reference-product-order-draft-v1";

export function createReferenceProductOrderDraft(
  id: string,
  product: ReferenceProduct
): ReferenceProductOrderDraft {
  return {
    id,
    productId: product.id,
    personalizationProfileId: "",
    personalizationText: "",
    personalizationArtwork: null,
    placementLabel: product.memorialTag.enabled ? product.memorialTag.sides.front.label : "적용 위치 확인 필요",
    companyName: "",
    contactName: "",
    contactPhone: "",
    quantity: 100,
    desiredDeliveryDate: "",
    purpose: "production",
    orderNote: "",
    consent: false,
  };
}

export function restoreReferenceProductOrderDraft(productId: string) {
  try {
    const stored = window.sessionStorage.getItem(referenceProductOrderDraftStorageKey);
    if (!stored) return null;
    const parsed = referenceProductOrderDraftSchema.safeParse(JSON.parse(stored));
    return parsed.success && parsed.data.productId === productId ? parsed.data : null;
  } catch {
    return null;
  }
}

export function persistReferenceProductOrderDraft(draft: ReferenceProductOrderDraft) {
  try {
    window.sessionStorage.setItem(referenceProductOrderDraftStorageKey, JSON.stringify(draft));
  } catch {
    // Large local previews can exceed a browser quota; the order can still continue in this tab.
  }
}

export function clearReferenceProductOrderDraft() {
  try {
    window.sessionStorage.removeItem(referenceProductOrderDraftStorageKey);
  } catch {
    // No action is required when storage is unavailable.
  }
}

function dataUrlToBlob(dataUrl: string) {
  return fetch(dataUrl).then(response => {
    if (!response.ok) throw Error("개인화 이미지를 다시 읽지 못했습니다. 파일을 다시 선택해 주세요.");
    return response.blob();
  });
}

export function referenceProductOrderSnapshot(
  product: ReferenceProduct,
  profile: PersonalizationProfile,
  draft: ReferenceProductOrderDraft
) {
  return {
    productId: product.id,
    sku: product.sku,
    title: product.title,
    productVersion: "v01",
    modelVersion: product.model3d?.version ?? null,
    modelChecksumSha256: product.model3d?.checksumSha256 ?? null,
    personalizationProfileId: profile.id,
    personalizationLabel: profile.label,
    safeArea: profile.constraints.safeAreaLabel,
    placementLabel: draft.placementLabel,
  };
}

export async function submitReferenceProductOrder(
  product: ReferenceProduct,
  profile: PersonalizationProfile,
  draft: ReferenceProductOrderDraft
) {
  if (!supabase) throw Error("온라인 주문 접수 연결을 준비하지 못했습니다.");
  const valid = referenceProductOrderSubmissionSchema.parse(draft);
  if (valid.productId !== product.id) throw Error("선택한 상품이 변경되었습니다. 주문 내용을 다시 확인해 주세요.");
  if (valid.personalizationProfileId !== profile.id) throw Error("개인화 방식을 다시 선택해 주세요.");
  if (!valid.personalizationText.trim() && !valid.personalizationArtwork) {
    throw Error("개인화 문구 또는 브랜드 마크를 확인해 주세요.");
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw Error("이메일 로그인 후 요청을 보낼 수 있습니다.");

  let personalizationImagePath: string | null = null;
  if (valid.personalizationArtwork) {
    personalizationImagePath = `${user.id}/${valid.id}/personalization-artwork`;
    const image = await dataUrlToBlob(valid.personalizationArtwork.dataUrl);
    const { error } = await supabase.storage
      .from("buyer-personalization-assets")
      .upload(personalizationImagePath, image, {
        contentType: valid.personalizationArtwork.mimeType,
        upsert: true,
      });
    if (error) throw Error("브랜드 마크를 private 보관함에 저장하지 못했습니다. 다시 시도해 주세요.");
  }

  const snapshot = referenceProductOrderSnapshot(product, profile, valid);
  const { data, error } = await supabase.rpc("submit_reference_product_order", {
    p_id: valid.id,
    p_company_name: valid.companyName,
    p_contact_name: valid.contactName,
    p_contact_phone: valid.contactPhone,
    p_reference_product_source_id: snapshot.productId,
    p_reference_product_sku: snapshot.sku,
    p_reference_product_title: snapshot.title,
    p_reference_product_version: snapshot.productVersion,
    p_model_version: snapshot.modelVersion,
    p_model_checksum_sha256: snapshot.modelChecksumSha256,
    p_personalization_profile_code: snapshot.personalizationProfileId,
    p_personalization_label: snapshot.personalizationLabel,
    p_personalization_safe_area: snapshot.safeArea,
    p_personalization_text: valid.personalizationText.trim() || null,
    p_personalization_image_path: personalizationImagePath,
    p_personalization_image_name: valid.personalizationArtwork?.name ?? null,
    p_personalization_image_mime: valid.personalizationArtwork?.mimeType ?? null,
    p_personalization_image_bytes: valid.personalizationArtwork?.byteSize ?? null,
    p_placement_label: snapshot.placementLabel,
    p_quantity: valid.quantity,
    p_desired_delivery_date: valid.desiredDeliveryDate || null,
    p_purpose: valid.purpose,
    p_order_note: valid.orderNote,
  });
  if (error) {
    if (error.message.includes("AUTH_REQUIRED")) throw Error("이메일 로그인 후 요청을 보낼 수 있습니다.");
    if (error.message.includes("PERSONALIZATION_ASSET_NOT_FOUND")) throw Error("브랜드 마크를 다시 선택한 뒤 요청해 주세요.");
    throw Error("요청 접수 확인을 받지 못했습니다. 같은 버튼으로 다시 시도하면 중복 접수를 방지합니다.");
  }
  return String(data);
}
