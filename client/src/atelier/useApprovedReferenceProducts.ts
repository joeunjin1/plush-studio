import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ReferenceProduct, ReferenceViewId } from "./referenceProducts";

type DbImage = { view_key: ReferenceViewId; storage_path: string; is_active: boolean };
type DbProfile = { personalization_method_profiles?: { code?: string } | Array<{ code?: string }> | null };
type DbProduct = {
  id: string;
  sku: string;
  title: string;
  product_family: ReferenceProduct["family"];
  color_option: string;
  reference_product_images?: DbImage[] | null;
  reference_product_personalization_methods?: DbProfile[] | null;
};

const requiredViews: ReferenceViewId[] = ["front", "left", "rear", "right", "top"];
const labels: Record<ReferenceViewId, string> = {
  front: "정면",
  left: "좌측면",
  rear: "뒷면",
  right: "우측면",
  top: "윗면",
};

function internalProfileId(code: string) {
  return code.trim().toLowerCase().replaceAll("_", "-");
}

function profileCodes(rows: DbProfile[] | null | undefined) {
  return (rows ?? []).flatMap(row => {
    const profile = row.personalization_method_profiles;
    const candidates = Array.isArray(profile) ? profile : profile ? [profile] : [];
    return candidates.flatMap(item => typeof item.code === "string" ? [internalProfileId(item.code)] : []);
  });
}

export function toApprovedReferenceProduct(row: DbProduct, catalogBaseUrl: string): ReferenceProduct | null {
  const images = (row.reference_product_images ?? []).filter(image => image.is_active);
  const byView = new Map(images.map(image => [image.view_key, image]));
  const profiles = profileCodes(row.reference_product_personalization_methods);
  if (!requiredViews.every(view => byView.has(view)) || profiles.length === 0) return null;

  const views = Object.fromEntries(requiredViews.map(view => [view, {
    label: labels[view],
    image: `${catalogBaseUrl}/${byView.get(view)!.storage_path}`,
  }])) as ReferenceProduct["views"];
  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    family: row.product_family,
    colorLabel: row.color_option || "컬러 검토 완료",
    sourceStatus: "reviewed",
    reviewLabel: "검토 완료 · 공식 5면 기준 상품",
    personalizationProfileIds: profiles,
    views,
    memorialTag: {
      enabled: false,
      maxCharacters: 0,
      maxLines: 0,
      sides: {
        front: { label: "", image: "" },
        back: { label: "", image: "" },
      },
    },
  };
}

export function useApprovedReferenceProducts() {
  const [products, setProducts] = useState<ReferenceProduct[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setReady(true);
      return;
    }
    let live = true;
    const load = async () => {
      const { data, error } = await client
        .from("reference_products")
        .select("id, sku, title, product_family, color_option, reference_product_images(view_key, storage_path, is_active), reference_product_personalization_methods(personalization_method_profiles(code))")
        .eq("visible_to_buyers", true)
        .eq("review_status", "approved")
        .order("created_at", { ascending: false });
      const catalogBaseUrl = `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "")}/storage/v1/object/public/plush-studio-catalog`;
      if (live && !error && Array.isArray(data)) {
        setProducts((data as unknown as DbProduct[]).flatMap(row => {
          const product = toApprovedReferenceProduct(row, catalogBaseUrl);
          return product ? [product] : [];
        }));
      }
      if (live) setReady(true);
    };
    void load();
    return () => { live = false; };
  }, []);

  return { products, ready };
}
