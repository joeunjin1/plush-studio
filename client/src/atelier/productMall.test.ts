import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mallSource = readFileSync(new URL("./ProductMall.tsx", import.meta.url), "utf8");
const atelierSource = readFileSync(new URL("./Atelier.tsx", import.meta.url), "utf8");

describe("buyer product mall", () => {
  it("shows registered five-view product metadata before personalization", () => {
    expect(mallSource).toContain("OFFICIAL PRODUCT MALL");
    expect(mallSource).toContain("5면 프리뷰");
    expect(mallSource).toContain("이 상품 개인화하기");
  });

  it("opens the mall by URL and moves the selected item into the personalization stage", () => {
    expect(atelierSource).toContain('get("mall") === "1"');
    expect(atelierSource).toContain("<ProductMall");
    expect(atelierSource).toContain("setReferenceProductId(product.id)");
    expect(atelierSource).toContain("개인화 방식을 먼저 고른 뒤 내용을 적용해 주세요.");
  });
});
