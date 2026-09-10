import { describe, expect, it } from "vitest";
import source from "./ReferenceProductMasterIntake.tsx?raw";

describe("ReferenceProductMasterIntake", () => {
  it("stores bilingual product metadata, dimensions, and rights confirmation as a non-public draft", () => {
    expect(source).toContain("title_en");
    expect(source).toContain("category_code");
    expect(source).toContain("physical_width_cm");
    expect(source).toContain("carton_width_cm");
    expect(source).toContain("rights_confirmation_note");
    expect(source).toContain('review_status: "draft"');
    expect(source).toContain("visible_to_buyers: false");
  });

  it("blocks duplicate SKU and incomplete dimensions before creating a draft", () => {
    expect(source).toContain("같은 조직에 동일 SKU가 이미 등록되어 있습니다");
    expect(source).toContain("실물 및 박스의 가로·세로·높이를 모두");
    expect(source).toContain("계산 CBM");
  });
});
