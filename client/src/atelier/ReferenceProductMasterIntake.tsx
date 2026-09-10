import { useState } from "react";
import { ClipboardPlus, LoaderCircle, Ruler, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ProductFamily = "plush" | "bag" | "shirt" | "other";

type Props = {
  organizationId: string;
  userId: string;
  onCreated: (productId: string) => Promise<void>;
};

const initialForm = {
  sku: "",
  title: "",
  titleEn: "",
  family: "plush" as ProductFamily,
  categoryCode: "general",
  colorOption: "",
  width: "",
  height: "",
  depth: "",
  cartonWidth: "",
  cartonHeight: "",
  cartonDepth: "",
  rightsNote: "",
};

function positive(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function messageFor(error: unknown) {
  if (error && typeof error === "object" && "code" in error && error.code === "42703") {
    return "migration 015를 staging에 적용하면 영문명·카테고리·5면 사진 초안 등록을 시작할 수 있습니다.";
  }
  if (error && typeof error === "object" && "code" in error && error.code === "23505") {
    return "같은 조직에 동일 SKU가 이미 등록되어 있습니다. SKU를 확인해 주세요.";
  }
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : "상품 초안 등록에 실패했습니다.";
}

export function ReferenceProductMasterIntake({ organizationId, userId, onCreated }: Props) {
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const set = (key: keyof typeof initialForm, value: string) => setForm(current => ({ ...current, [key]: value }));
  const cbm = [form.cartonWidth, form.cartonHeight, form.cartonDepth].map(positive);
  const calculatedCbm = cbm.every(Boolean) ? (cbm[0]! * cbm[1]! * cbm[2]!) / 1_000_000 : null;

  const submit = async () => {
    if (!supabase || busy) return;
    const dimensions = [form.width, form.height, form.depth, form.cartonWidth, form.cartonHeight, form.cartonDepth].map(positive);
    if (!/^[A-Z0-9][A-Z0-9_-]{2,60}$/.test(form.sku.trim())) {
      setMessage("SKU는 대문자 영문·숫자·밑줄·하이픈으로 3~61자 입력해 주세요.");
      return;
    }
    if (form.title.trim().length < 2 || form.titleEn.trim().length < 2) {
      setMessage("한글 상품명과 영문 상품명을 각각 2자 이상 입력해 주세요.");
      return;
    }
    if (dimensions.some(value => value === null)) {
      setMessage("실물 및 박스의 가로·세로·높이를 모두 0보다 큰 값으로 입력해 주세요.");
      return;
    }
    if (!form.rightsNote.trim()) {
      setMessage("상품 이미지·3D 원본 사용 권리 확인 내용을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setMessage("상품 마스터 초안을 등록하는 중…");
    try {
      const { data, error } = await supabase
        .from("reference_products")
        .insert({
          organization_id: organizationId,
          sku: form.sku.trim(),
          title: form.title.trim(),
          title_en: form.titleEn.trim(),
          product_family: form.family,
          category_code: form.categoryCode.trim().toLowerCase(),
          color_option: form.colorOption.trim(),
          physical_width_cm: dimensions[0],
          physical_height_cm: dimensions[1],
          physical_depth_cm: dimensions[2],
          carton_width_cm: dimensions[3],
          carton_height_cm: dimensions[4],
          carton_depth_cm: dimensions[5],
          source_status: "seller_supplied",
          review_status: "draft",
          visible_to_buyers: false,
          rights_confirmed_at: new Date().toISOString(),
          rights_confirmation_note: form.rightsNote.trim(),
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      setForm(initialForm);
      setMessage("상품 초안을 등록했습니다. 다음으로 5면 사진과 선택 GLB 원본을 private 초안으로 등록해 주세요.");
      await onCreated(data.id);
    } catch (error) {
      setMessage(messageFor(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="at-product-master-intake" aria-labelledby="product-master-intake-title">
      <div className="at-model-admin-card-heading">
        <ClipboardPlus size={20} />
        <div><span>01 · PRODUCT DRAFT</span><h2 id="product-master-intake-title">상품 마스터 초안 등록</h2></div>
      </div>
      <p className="at-product-master-intake-copy">SKU·한글/영문 상품명·실물/박스 치수와 권리 확인을 먼저 등록합니다. CBM은 박스 치수에서 자동 계산되며, 검토·5면 등록 전에는 buyer mall에 공개되지 않습니다.</p>
      <div className="at-product-master-fields">
        <label><span>SKU</span><input autoCapitalize="characters" disabled={busy} maxLength={61} onChange={event => set("sku", event.target.value.toUpperCase())} placeholder="예: PS-BERNESE-001" value={form.sku} /></label>
        <label><span>상품명 (한국어)</span><input disabled={busy} maxLength={160} onChange={event => set("title", event.target.value)} placeholder="예: 버니즈 기념 독 인형" value={form.title} /></label>
        <label><span>Product name (English)</span><input disabled={busy} maxLength={160} onChange={event => set("titleEn", event.target.value)} placeholder="Example: Bernese Memorial Plush" value={form.titleEn} /></label>
        <label><span>상품군</span><select disabled={busy} onChange={event => set("family", event.target.value)} value={form.family}><option value="plush">봉제인형</option><option value="bag">가방</option><option value="shirt">의류</option><option value="other">기타</option></select></label>
        <label><span>카테고리 코드</span><input disabled={busy} maxLength={61} onChange={event => set("categoryCode", event.target.value)} placeholder="예: memorial-plush" value={form.categoryCode} /></label>
        <label><span>색상 옵션</span><input disabled={busy} maxLength={160} onChange={event => set("colorOption", event.target.value)} placeholder="예: 블랙 · 화이트 · 브라운" value={form.colorOption} /></label>
      </div>
      <div className="at-product-master-dimensions">
        <div><span><Ruler size={15} /> 실물 치수 cm</span>{(["width", "height", "depth"] as const).map(key => <label key={key}><input inputMode="decimal" min="0.01" onChange={event => set(key, event.target.value)} placeholder={{ width: "가로", height: "세로", depth: "높이" }[key]} step="0.01" type="number" value={form[key]} /></label>)}</div>
        <div><span><Ruler size={15} /> 박스 치수 cm</span>{(["cartonWidth", "cartonHeight", "cartonDepth"] as const).map(key => <label key={key}><input inputMode="decimal" min="0.01" onChange={event => set(key, event.target.value)} placeholder={{ cartonWidth: "가로", cartonHeight: "세로", cartonDepth: "높이" }[key]} step="0.01" type="number" value={form[key]} /></label>)}</div>
        <p>계산 CBM <b>{calculatedCbm === null ? "치수 입력 필요" : calculatedCbm.toFixed(6)}</b></p>
      </div>
      <label className="at-product-master-rights"><span><ShieldCheck size={15} /> 이미지·3D 원본 사용 권리 확인</span><textarea disabled={busy} maxLength={500} onChange={event => set("rightsNote", event.target.value)} placeholder="예: 대표 제공 실물 사진·GLB이며 상품 등록 및 제작 검토에 사용할 권한을 확인했습니다." rows={3} value={form.rightsNote} /></label>
      <button className="at-primary at-model-admin-submit" disabled={busy || !organizationId} onClick={() => void submit()} type="button">{busy ? <><LoaderCircle className="at-spin" size={16} /> 상품 초안 등록 중…</> : "private 상품 마스터 초안 등록"}</button>
      {message && <p aria-live="polite" className="at-model-admin-message">{message}</p>}
    </section>
  );
}
