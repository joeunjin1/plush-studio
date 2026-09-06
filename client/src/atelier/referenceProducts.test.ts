import { describe, expect, it } from "vitest";
import {
  calculateCartonCbm,
  constrainMemorialMessage,
  referenceProductById,
  referenceProducts,
  referenceViewIds,
} from "./referenceProducts";

describe("reviewed reference product catalog", () => {
  it("registers the Bernese memorial plush with every required reference view", () => {
    const product = referenceProductById("bernese-memorial-plush-v01");
    expect(product?.sku).toBe("PS-BERNESE-MEMORIAL-001");
    expect(product?.sourceStatus).toBe("seller-supplied");
    expect(referenceViewIds.every(view => Boolean(product?.views[view].image))).toBe(true);
  });

  it("uses an environment-specific public catalog location outside local development", () => {
    const source = referenceProducts[0].views.front.image;
    expect(source).toContain("/manus-storage/");
  });

  it("keeps tag text constrained and marks the preview as not yet factory approved", () => {
    const product = referenceProducts[0];
    expect(product.memorialTag.maxCharacters).toBe(36);
    expect(product.memorialTag.maxLines).toBe(3);
    expect(product.reviewLabel).toContain("등록 전");
  });

  it("calculates carton CBM only when all carton dimensions are registered", () => {
    expect(calculateCartonCbm()).toBeNull();
    expect(calculateCartonCbm({ widthCm: 50, heightCm: 40, depthCm: 30 })).toBe(0.06);
  });

  it("keeps memorial text within the registered line and character limits", () => {
    expect(constrainMemorialMessage("one\ntwo\nthree\nfour", 36, 3)).toBe("one\ntwo\nthree");
    expect(constrainMemorialMessage("123456", 4, 3)).toBe("1234");
  });
});
