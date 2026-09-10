import { describe, expect, it } from "vitest";
import source from "./ReferenceProductOrderHistory.tsx?raw";

describe("ReferenceProductOrderHistory", () => {
  it("queries the protected official-order table with metadata-only columns", () => {
    expect(source).toContain('from("reference_product_order_requests")');
    expect(source).toContain('.select(orderColumns)');
    expect(source).toContain('"model_version"');
    expect(source).toContain('"reference_product_version"');
    expect(source).not.toContain("personalization_text");
    expect(source).not.toContain("personalization_image_path");
    expect(source).not.toContain("contact_phone");
  });

  it("shows only current buyer-company requests and excludes terminal records", () => {
    expect(source).toContain('.not("status", "in", "(completed,closed)")');
    expect(source).toContain("OFFICIAL PRODUCT REQUESTS");
    expect(source).toContain("진행 중인 공식 상품 제작 요청이 없습니다.");
  });
});
