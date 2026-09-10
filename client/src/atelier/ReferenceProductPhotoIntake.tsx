import { useEffect, useMemo, useState } from "react";
import { ImagePlus, LoaderCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  analyzeReferencePhoto,
  hasCompleteRequiredReferencePhotoSet,
  referencePhotoStoragePath,
  referencePhotoViewLabels,
  requiredReferencePhotoViews,
  type ReferencePhotoAnalysis,
  type ReferencePhotoViewKey,
} from "./referenceProductPhotoRegistration";

type ExistingIntake = { view_key: ReferencePhotoViewKey; review_state: string };

type Props = {
  organizationId: string;
  productId: string;
  userId: string;
};

function errorMessage(error: unknown) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : "5면 사진 초안 등록에 실패했습니다.";
}

export function ReferenceProductPhotoIntake({ organizationId, productId, userId }: Props) {
  const [files, setFiles] = useState<Partial<Record<ReferencePhotoViewKey, File>>>({});
  const [analysis, setAnalysis] = useState<Partial<Record<ReferencePhotoViewKey, ReferencePhotoAnalysis>>>({});
  const [existing, setExisting] = useState<ExistingIntake[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const existingViews = useMemo(() => new Set(existing.map(item => item.view_key)), [existing]);
  const isComplete = hasCompleteRequiredReferencePhotoSet(files);

  const refreshExisting = async () => {
    if (!supabase || !productId) return;
    const { data, error } = await supabase
      .from("reference_product_image_intakes")
      .select("view_key, review_state")
      .eq("reference_product_id", productId)
      .in("view_key", requiredReferencePhotoViews);
    if (error) {
      setMessage(error.code === "42P01" ? "migration 015를 staging에 적용하면 5면 사진 초안 등록을 시작할 수 있습니다." : "기존 5면 사진 초안을 불러오지 못했습니다.");
      return;
    }
    setExisting((data ?? []) as ExistingIntake[]);
  };

  useEffect(() => {
    setFiles({});
    setAnalysis({});
    setMessage("");
    void refreshExisting();
  }, [productId]);

  const chooseFile = async (viewKey: ReferencePhotoViewKey, file?: File) => {
    if (!file) return;
    try {
      const nextAnalysis = await analyzeReferencePhoto(file);
      setFiles(current => ({ ...current, [viewKey]: file }));
      setAnalysis(current => ({ ...current, [viewKey]: nextAnalysis }));
      setMessage(`${referencePhotoViewLabels[viewKey]} 사진을 확인했습니다.`);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const submit = async () => {
    if (!supabase || !isComplete || busy) return;
    if (existingViews.size > 0) {
      setMessage("이미 초안이 있는 면이 있습니다. 기존 초안을 검토하거나 정리한 뒤 다시 등록해 주세요.");
      return;
    }
    setBusy(true);
    setMessage("5면 원본을 private storage에 올리고 초안 메타데이터를 등록하는 중…");
    const uploadedPaths: string[] = [];
    const insertedPaths: string[] = [];
    try {
      for (const viewKey of requiredReferencePhotoViews) {
        const file = files[viewKey]!;
        const fileAnalysis = analysis[viewKey]!;
        const storagePath = referencePhotoStoragePath(organizationId, productId, viewKey, file.name);
        const { error: uploadError } = await supabase.storage.from("plush-studio").upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(storagePath);
        const { error: insertError } = await supabase.from("reference_product_image_intakes").insert({
          reference_product_id: productId,
          view_key: viewKey,
          source_storage_bucket: "plush-studio",
          source_storage_path: storagePath,
          original_filename: file.name,
          mime_type: file.type,
          byte_size: fileAnalysis.byteSize,
          pixel_width: fileAnalysis.pixelWidth,
          pixel_height: fileAnalysis.pixelHeight,
          review_state: "draft",
          uploaded_by: userId,
        });
        if (insertError) throw insertError;
        insertedPaths.push(storagePath);
      }
      setFiles({});
      setAnalysis({});
      setMessage("5면 사진 초안을 등록했습니다. 권리 확인·구도 검토·public catalog 복사·상품 승인 전에는 구매자에게 노출되지 않습니다.");
      await refreshExisting();
    } catch (error) {
      if (insertedPaths.length > 0) {
        await supabase.from("reference_product_image_intakes").delete().in("source_storage_path", insertedPaths);
      }
      if (uploadedPaths.length > 0) await supabase.storage.from("plush-studio").remove(uploadedPaths);
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="at-photo-intake" aria-labelledby="photo-intake-title">
      <div className="at-model-admin-card-heading">
        <ImagePlus size={20} />
        <div><span>02 · FIVE-VIEW DRAFT</span><h2 id="photo-intake-title">공식 5면 사진 초안 등록</h2></div>
      </div>
      <p className="at-photo-intake-copy">정면·좌측·뒷면·우측·윗면은 모두 필요합니다. 원본은 private storage에 보관되며, 승인 전에는 buyer mall에 표시되지 않습니다.</p>
      <div className="at-photo-intake-grid">
        {requiredReferencePhotoViews.map(viewKey => {
          const selected = files[viewKey];
          const row = existing.find(item => item.view_key === viewKey);
          return (
            <label className="at-photo-intake-file" key={viewKey}>
              <span>{referencePhotoViewLabels[viewKey]}</span>
              <input accept="image/png,image/jpeg,image/webp" disabled={busy || Boolean(row)} onChange={event => void chooseFile(viewKey, event.target.files?.[0])} type="file" />
              <small>{row ? `${row.review_state} 초안 등록됨` : selected ? `${analysis[viewKey]?.pixelWidth} × ${analysis[viewKey]?.pixelHeight}px` : "PNG · JPG · WebP · 10MB 이하"}</small>
            </label>
          );
        })}
      </div>
      <button className="at-primary at-model-admin-submit" disabled={!isComplete || busy || existingViews.size > 0} onClick={() => void submit()} type="button">
        {busy ? <><LoaderCircle className="at-spin" size={16} /> 5면 초안 등록 중…</> : "private 5면 사진 · 초안 메타데이터 등록"}
      </button>
      <p className="at-photo-intake-note"><ShieldCheck size={15} /> 사진 5면·권리 확인·상품 사양·공개 검토가 완료된 뒤에만 public catalog 복사본을 생성합니다.</p>
      {message && <p aria-live="polite" className="at-model-admin-message">{message}</p>}
    </section>
  );
}
