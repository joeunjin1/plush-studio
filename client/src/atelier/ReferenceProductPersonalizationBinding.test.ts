import bindingSource from "./ReferenceProductPersonalizationBinding.tsx?raw";
import { describe, expect, it } from "vitest";

describe("reference product personalization binding", () => {
  it("reads eligible active profiles and stores only product-to-profile mappings", () => {
    expect(bindingSource).toContain("personalization_method_profiles");
    expect(bindingSource).toContain("reference_product_personalization_methods");
    expect(bindingSource).toContain("supported_families.includes(productFamily)");
    expect(bindingSource).toContain("reference_product_id: productId");
  });

  it("does not expose source assets or create generic production methods", () => {
    expect(bindingSource).not.toContain("storage.from");
    expect(bindingSource).not.toContain("insert({ code:");
  });
});
