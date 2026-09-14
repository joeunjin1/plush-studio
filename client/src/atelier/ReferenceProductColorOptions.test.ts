import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ReferenceProductColorOptions.tsx", import.meta.url), "utf8");

describe("reference product color options", () => {
  it("limits administrator configuration to the body and handle colors for the selected SKU", () => {
    expect(source).toContain('body_color');
    expect(source).toContain('handle_color');
    expect(source).toContain('reference_product_id: productId');
    expect(source).toContain('onConflict: "reference_product_id,option_key"');
  });

  it("makes buyer visibility and factory-review boundaries explicit", () => {
    expect(source).toContain("buyer 선택 허용");
    expect(source).toContain("공장 검토 후 확정");
    expect(source).toContain("migration 018을 staging에 적용");
  });
});
