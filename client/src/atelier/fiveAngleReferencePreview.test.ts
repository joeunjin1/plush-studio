import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./FiveAngleReferencePreview.tsx", import.meta.url),
  "utf8"
);

describe("five-angle reference preview", () => {
  it("provides five-view controls, a GLB mode with fallback, and clear review limitations", () => {
    expect(source).toContain("referenceViewIds.map");
    expect(source).toContain("사진 부드러운 회전");
    expect(source).toContain("BerneseModelViewer");
    expect(source).toContain("lazy(() => import(\"./BerneseModelViewer\"))");
    expect(source).toContain("product.model3d.label");
    expect(source).toContain("검수된 5면 사진 프리뷰로 전환했습니다");
  });

  it("offers selectable memorial-tag faces and a profile-gated text or artwork editor", () => {
    expect(source).toContain("Object.keys(product.memorialTag.sides)");
    expect(source).toContain("product.memorialTag.sides[side].label");
    expect(source).toContain("개인화 방식 선택");
    expect(source).toContain("constrainPersonalizationText");
    expect(source).toContain("브랜드 마크 이미지 첨부");
  });

  it("keeps personalization in method, content, and review steps", () => {
    expect(source).toContain('"method" | "content" | "review"');
    expect(source).toContain('setPersonalizationStep("content")');
    expect(source).toContain('setPersonalizationStep("review")');
    expect(source).toContain("프리뷰 확인");
    expect(source).toContain("이 개인화 방식 선택");
  });

  it("supports image or text personalization for non-memorial products such as reviewed bag SKUs", () => {
    expect(source).toContain("!product.memorialTag.enabled");
    expect(source).toContain("상품 로고 및 문구 개인화 설정");
    expect(source).toContain("정면 안전영역 참고 프리뷰");
    expect(source).toContain("원본은 요청 접수 시 private 보관함에만 저장됩니다.");
    expect(source).toContain("const hasPersonalizationContent");
    expect(source).toContain('selectedProfile.inputMode === "text"');
    expect(source).toContain('selectedProfile.inputMode === "image"');
  });
});
