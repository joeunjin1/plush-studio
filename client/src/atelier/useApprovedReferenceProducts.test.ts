import { describe, expect, it } from "vitest";
import { toApprovedReferenceProduct } from "./useApprovedReferenceProducts";
import { readFileSync } from "node:fs";

const base = {
  id: "db-product",
  sku: "PS-DB-001",
  title: "DB 검토 상품",
  product_family: "plush" as const,
  color_option: "브라운",
  reference_product_images: ["front", "left", "rear", "right", "top"].map(view => ({ view_key: view, storage_path: `org/product/${view}.webp`, is_active: true })),
  reference_product_personalization_methods: [{ personalization_method_profiles: { code: "MEMORIAL_TAG_TEXT_V01" } }],
};

describe("approved reference product mapper", () => {
  it("returns only a complete five-view product with at least one active method", () => {
    const product = toApprovedReferenceProduct(base, "https://catalog.example");
    expect(product?.personalizationProfileIds).toEqual(["memorial-tag-text-v01"]);
    expect(product?.views.rear.image).toBe("https://catalog.example/org/product/rear.webp");
    expect(product?.sourceStatus).toBe("reviewed");
  });

  it("rejects incomplete or methodless rows before they reach the buyer mall", () => {
    expect(toApprovedReferenceProduct({ ...base, reference_product_images: base.reference_product_images.slice(0, 4) }, "https://catalog.example")).toBeNull();
    expect(toApprovedReferenceProduct({ ...base, reference_product_personalization_methods: [] }, "https://catalog.example")).toBeNull();
  });

  it("maps only database-backed SKU customization options when available", () => {
    const product = toApprovedReferenceProduct({
      ...base,
      reference_product_customization_options: [{
        option_key: "body_color",
        label: "가방 본체 색상",
        description: "부직포 외피 색상",
        placement_label: "본체",
        is_required: true,
        display_order: 10,
        factory_review_note: "원단 스와치 확인",
        allowed_values: [{ id: "ivory", label: "아이보리", hex: "#f4f0e6" }],
      }],
    }, "https://catalog.example");
    expect(product?.customizationOptions?.[0].optionKey).toBe("body_color");
    expect(product?.customizationOptions?.[0].values[0].label).toBe("아이보리");
  });

  it("limits legacy fallback to a missing customization-options relation", () => {
    const source = readFileSync(new URL("./useApprovedReferenceProducts.ts", import.meta.url), "utf8");
    expect(source).toContain('error.code === "PGRST200"');
    expect(source).toContain('error.code === "PGRST205"');
    expect(source).toContain('error.message?.includes("reference_product_customization_options")');
  });
});
