import type { SupabaseClient } from "@supabase/supabase-js";
import { requiredReferencePhotoViews, type ReferencePhotoViewKey } from "./referenceProductPhotoRegistration";

export type ReferenceProductPhotoIntakeRow = {
  id: string;
  reference_product_id: string;
  view_key: ReferencePhotoViewKey;
  source_storage_bucket: "plush-studio";
  source_storage_path: string;
  original_filename: string;
  mime_type: "image/png" | "image/jpeg" | "image/webp";
  review_state: string;
};

type PublicationAsset = { intake_id: string; public_storage_path: string };

function safeFilename(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "reference-image";
}

export function catalogPhotoPublicationPath(
  organizationId: string,
  productId: string,
  intake: Pick<ReferenceProductPhotoIntakeRow, "id" | "view_key" | "original_filename">
) {
  return `${organizationId}/reference-products/${productId}/images/${intake.view_key}/${intake.id}-${safeFilename(intake.original_filename)}`;
}

export function fiveRequiredPhotoIntakes(rows: ReferenceProductPhotoIntakeRow[]) {
  const byView = new Map(rows.filter(row => requiredReferencePhotoViews.includes(row.view_key as never)).map(row => [row.view_key, row]));
  const required = requiredReferencePhotoViews.map(view => byView.get(view));
  return required.every((row): row is ReferenceProductPhotoIntakeRow => Boolean(row)) ? required : null;
}

export async function publishReferenceProductPhotoCopies({
  supabase,
  organizationId,
  productId,
  photoIntakes,
  reviewNote,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  productId: string;
  photoIntakes: ReferenceProductPhotoIntakeRow[];
  reviewNote: string;
}) {
  const requiredIntakes = fiveRequiredPhotoIntakes(photoIntakes);
  if (!requiredIntakes) throw Error("정면·좌측·뒷면·우측·윗면의 private 초안 5건을 모두 등록해 주세요.");
  if (requiredIntakes.some(row => !["draft", "pending_review"].includes(row.review_state))) {
    throw Error("이미 승인 또는 종료된 사진이 포함되어 있습니다. 새로고침 후 검토 상태를 확인해 주세요.");
  }

  const uploadedPaths: string[] = [];
  const publicAssets: PublicationAsset[] = [];
  try {
    for (const intake of requiredIntakes) {
      const { data: signed, error: signedError } = await supabase.storage
        .from(intake.source_storage_bucket)
        .createSignedUrl(intake.source_storage_path, 120);
      if (signedError || !signed?.signedUrl) throw signedError ?? Error("private 원본의 임시 읽기 주소를 만들지 못했습니다.");
      const response = await fetch(signed.signedUrl);
      if (!response.ok) throw Error("private 원본 사진을 읽지 못했습니다.");
      const publicStoragePath = catalogPhotoPublicationPath(organizationId, productId, intake);
      const { error: uploadError } = await supabase.storage
        .from("plush-studio-catalog")
        .upload(publicStoragePath, await response.blob(), { contentType: intake.mime_type, upsert: false });
      if (uploadError) throw uploadError;
      uploadedPaths.push(publicStoragePath);
      publicAssets.push({ intake_id: intake.id, public_storage_path: publicStoragePath });
    }
    const { data, error } = await supabase.rpc("publish_reviewed_reference_product_photos", {
      p_reference_product_id: productId,
      p_public_assets: publicAssets,
      p_review_note: reviewNote.trim() || null,
    });
    if (error) throw error;
    return String(data);
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from("plush-studio-catalog").remove(uploadedPaths);
    throw error;
  }
}
