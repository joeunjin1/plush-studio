import { describe, expect, it } from "vitest";
import { toApprovedReferenceProduct } from "./useApprovedReferenceProducts";

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
});
