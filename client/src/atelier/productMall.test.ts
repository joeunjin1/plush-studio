import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mallSource = readFileSync(new URL("./ProductMall.tsx", import.meta.url), "utf8");
const atelierSource = readFileSync(new URL("./Atelier.tsx", import.meta.url), "utf8");

describe("buyer product mall", () => {
  it("shows registered five-view product metadata before personalization", () => {
    expect(mallSource).toContain("OFFICIAL REAL PRODUCT MALL");
    expect(mallSource).toContain("5면 프리뷰");
    expect(mallSource).toContain("사양 선택 · 제작 요청");
    expect(mallSource).toContain("OFFICIAL REAL PRODUCT MALL");
    expect(mallSource).toContain("onStartFreeDesign");
  });

  it("opens the mall by default and moves the selected item into the personalization stage", () => {
    expect(atelierSource).toContain('search.get("maker") !== "1" && !search.get("reference")');
    expect(atelierSource).toContain("<ProductMall");
    expect(atelierSource).toContain("setReferenceProductId(product.id)");
    expect(atelierSource).toContain("개인화 방식을 먼저 고른 뒤 내용을 적용해 주세요.");
    expect(atelierSource).toContain("initialProductMallOpen");
    expect(atelierSource).toContain("자유 3D 설계 작업을 열었습니다.");
  });
});
