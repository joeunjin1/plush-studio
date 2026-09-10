import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  code: string;
  label: string;
  method: string;
  supported_families: string[];
  is_active: boolean;
};

function readableError(error: unknown) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : "개인화 방식 연결을 저장하지 못했습니다.";
}

export function ReferenceProductPersonalizationBinding({
  organizationId,
  productFamily,
  productId,
}: {
  organizationId: string;
  productFamily: "plush" | "bag" | "shirt" | "other";
  productId: string;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const eligibleProfiles = useMemo(
    () => profiles.filter(profile => profile.is_active && profile.supported_families.includes(productFamily)),
    [productFamily, profiles]
  );

  useEffect(() => {
    const client = supabase;
    if (!client || !organizationId || !productId) return;
    let live = true;
    const load = async () => {
      const [{ data: profileRows, error: profileError }, { data: bindingRows, error: bindingError }] = await Promise.all([
        client.from("personalization_method_profiles").select("id, code, label, method, supported_families, is_active").eq("organization_id", organizationId).eq("is_active", true).order("label"),
        client.from("reference_product_personalization_methods").select("personalization_method_profile_id").eq("reference_product_id", productId),
      ]);
      if (!live) return;
      if (profileError || bindingError) {
        setMessage(profileError?.code === "42P01" || bindingError?.code === "42P01" ? "migration 010을 staging에 적용하면 개인화 방식 연결을 시작할 수 있습니다." : "개인화 방식 목록을 불러오지 못했습니다.");
        return;
      }
      setProfiles((profileRows ?? []) as Profile[]);
      setSelected((bindingRows ?? []).map(row => row.personalization_method_profile_id));
      setMessage("");
    };
    void load();
    return () => { live = false; };
  }, [organizationId, productId]);

  const toggle = async (profileId: string, checked: boolean) => {
    if (!supabase || busyId) return;
    setBusyId(profileId);
    setMessage("");
    try {
      const { error } = checked
        ? await supabase.from("reference_product_personalization_methods").upsert({ reference_product_id: productId, personalization_method_profile_id: profileId, sort_order: selected.length * 10, is_default: selected.length === 0 }, { onConflict: "reference_product_id,personalization_method_profile_id" })
        : await supabase.from("reference_product_personalization_methods").delete().eq("reference_product_id", productId).eq("personalization_method_profile_id", profileId);
      if (error) throw error;
      setSelected(current => checked ? [...current, profileId] : current.filter(id => id !== profileId));
    } catch (error) {
      setMessage(readableError(error));
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="at-profile-binding" aria-labelledby="profile-binding-title">
      <div className="at-model-admin-card-heading"><SlidersHorizontal size={20} /><div><span>04 · PERSONALIZATION</span><h2 id="profile-binding-title">상품별 개인화 방식</h2></div></div>
      <p className="at-product-master-intake-copy">이 SKU에 실제 적용 가능한 등록 방식을 선택하세요. 승인 공개에는 동일 상품군의 활성 방식이 최소 1개 필요합니다.</p>
      {eligibleProfiles.length ? <div className="at-profile-binding-list">{eligibleProfiles.map(profile => <label key={profile.id}><input checked={selected.includes(profile.id)} disabled={Boolean(busyId)} onChange={event => void toggle(profile.id, event.target.checked)} type="checkbox" /><span><b>{profile.label}</b><small>{profile.method} · {profile.code}</small></span></label>)}</div> : <p className="at-photo-intake-note">이 조직에 {productFamily}용 활성 개인화 프로필이 없습니다. 실제 공정 조건을 먼저 등록한 뒤 SKU에 연결하세요.</p>}
      {message && <p aria-live="polite" className="at-model-admin-message">{message}</p>}
    </section>
  );
}
