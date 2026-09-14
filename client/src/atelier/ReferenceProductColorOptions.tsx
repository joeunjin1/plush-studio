import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type ColorValue = { id: string; label: string; hex: string };
type ColorOption = {
  id: string;
  option_key: "body_color" | "handle_color";
  label: string;
  description: string;
  placement_label: string;
  allowed_values: ColorValue[];
  is_required: boolean;
  is_active: boolean;
  factory_review_note: string;
};

const palette: ColorValue[] = [
  { id: "ivory", label: "아이보리", hex: "#F3F0E7" },
  { id: "natural", label: "내추럴", hex: "#C8B58C" },
  { id: "black", label: "블랙", hex: "#1F2428" },
  { id: "navy", label: "네이비", hex: "#273B5D" },
  { id: "sage", label: "세이지", hex: "#899A7D" },
  { id: "burgundy", label: "버건디", hex: "#7D3341" },
];

const definitions = {
  body_color: {
    label: "가방 본체 색상",
    description: "부직포 외피에 적용할 본체 컬러입니다.",
    placementLabel: "부직포 외피 본체",
    factoryReviewNote: "모니터 색상은 참고용입니다. 실제 부직포 원단 스와치와 최소 생산 수량을 공장 검토 후 확정합니다.",
  },
  handle_color: {
    label: "손잡이 색상",
    description: "웨빙 손잡이에 적용할 컬러입니다.",
    placementLabel: "웨빙 손잡이",
    factoryReviewNote: "웨빙 재고·염색 가능 여부와 본체 원단의 조합은 공장 검토 후 확정합니다.",
  },
} as const;

function asColorValues(value: unknown): ColorValue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const color = item as Partial<ColorValue>;
    return typeof color.id === "string" && typeof color.label === "string" && typeof color.hex === "string" ? [{ id: color.id, label: color.label, hex: color.hex }] : [];
  });
}

type Props = { productId: string; supabase: SupabaseClient; onSaved: () => Promise<void> };

export function ReferenceProductColorOptions({ productId, supabase, onSaved }: Props) {
  const [rows, setRows] = useState<ColorOption[]>([]);
  const [selected, setSelected] = useState<Record<keyof typeof definitions, string[]>>({ body_color: ["ivory"], handle_color: ["black"] });
  const [active, setActive] = useState<Record<keyof typeof definitions, boolean>>({ body_color: true, handle_color: true });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const ready = useMemo(() => rows.length > 0, [rows.length]);

  const load = async () => {
    const { data, error } = await supabase
      .from("reference_product_customization_options")
      .select("id, option_key, label, description, placement_label, allowed_values, is_required, is_active, factory_review_note")
      .eq("reference_product_id", productId)
      .in("option_key", ["body_color", "handle_color"])
      .order("display_order", { ascending: true });
    if (error) {
      setMessage(error.code === "42P01" ? "migration 018을 staging에 적용하면 SKU별 색상 옵션을 설정할 수 있습니다." : "색상 옵션을 불러오지 못했습니다.");
      return;
    }
    const next = (data ?? []).map(row => ({ ...row, option_key: row.option_key as ColorOption["option_key"], allowed_values: asColorValues(row.allowed_values) })) as ColorOption[];
    setRows(next);
    setSelected(current => ({
      body_color: next.find(row => row.option_key === "body_color")?.allowed_values.map(value => value.id) ?? current.body_color,
      handle_color: next.find(row => row.option_key === "handle_color")?.allowed_values.map(value => value.id) ?? current.handle_color,
    }));
    setActive({
      body_color: next.find(row => row.option_key === "body_color")?.is_active ?? true,
      handle_color: next.find(row => row.option_key === "handle_color")?.is_active ?? true,
    });
    setMessage("");
  };

  useEffect(() => { void load(); }, [productId]);

  const toggleColor = (key: keyof typeof definitions, colorId: string) => {
    setSelected(current => {
      const existing = current[key];
      const next = existing.includes(colorId) ? existing.filter(value => value !== colorId) : [...existing, colorId];
      return { ...current, [key]: next };
    });
  };

  const save = async () => {
    const invalid = (Object.keys(definitions) as Array<keyof typeof definitions>).find(key => active[key] && selected[key].length === 0);
    if (invalid) {
      setMessage(`${definitions[invalid].label}에 최소 한 가지 색상을 선택해 주세요.`);
      return;
    }
    setBusy(true);
    setMessage("SKU별 색상 구성과 buyer 노출 규칙을 저장하는 중…");
    try {
      const records = (Object.keys(definitions) as Array<keyof typeof definitions>).map((key, index) => ({
        reference_product_id: productId,
        option_key: key,
        option_kind: "color",
        label: definitions[key].label,
        description: definitions[key].description,
        placement_label: definitions[key].placementLabel,
        allowed_values: palette.filter(color => selected[key].includes(color.id)),
        is_required: active[key],
        is_active: active[key],
        display_order: (index + 1) * 10,
        factory_review_note: definitions[key].factoryReviewNote,
      }));
      const { error } = await supabase.from("reference_product_customization_options").upsert(records, { onConflict: "reference_product_id,option_key" });
      if (error) throw error;
      await load();
      await onSaved();
      setMessage("이 SKU의 본체·손잡이 색상 선택 규칙을 저장했습니다. buyer는 활성화된 색상만 선택할 수 있습니다.");
    } catch {
      setMessage("색상 옵션을 저장하지 못했습니다. migration 018과 brand_admin 권한을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="at-product-color-options" aria-label="SKU별 색상 옵션 관리">
    <div className="at-model-admin-card-heading"><div><span>04 · SKU CONFIGURATION</span><h2>본체 · 손잡이 색상 규칙</h2></div></div>
    <p className="at-model-admin-footnote">이 SKU에서 buyer에게 보여줄 본체와 웨빙 손잡이 색상만 고르세요. 화면 색상은 참고용이며 실제 원단·웨빙·MOQ는 공장 검토 후 확정됩니다.</p>
    {(Object.keys(definitions) as Array<keyof typeof definitions>).map(key => <fieldset key={key} disabled={busy}>
      <legend>{definitions[key].label}</legend>
      <label className="at-color-option-active"><input checked={active[key]} onChange={event => setActive(current => ({ ...current, [key]: event.target.checked }))} type="checkbox" /> buyer 선택 허용</label>
      <div className="at-color-option-palette">{palette.map(color => <button aria-pressed={selected[key].includes(color.id)} key={color.id} onClick={() => toggleColor(key, color.id)} type="button">{/* Dynamic swatches use only the fixed administrator palette. */}<i style={{ backgroundColor: color.hex }} /><span>{color.label}</span></button>)}</div>
    </fieldset>)}
    <button className="at-primary at-model-admin-submit" disabled={busy} onClick={() => void save()} type="button">{busy ? "색상 규칙 저장 중…" : ready ? "SKU 색상 규칙 업데이트" : "SKU 색상 규칙 저장"}</button>
    {message && <p aria-live="polite" className="at-model-admin-message">{message}</p>}
  </section>;
}
