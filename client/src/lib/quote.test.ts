import { describe, expect, it } from "vitest";
import { calculateQuote, defaultCostInputs } from "./quote";

describe("calculateQuote", () => {
  it("calculates a consistent landed cost and margin-based selling price", () => {
    const result = calculateQuote(defaultCostInputs);

    expect(result.materialsCny).toBe(9.7);
    expect(result.laborCny).toBe(5.29);
    expect(result.unitCostCny).toBe(17.99);
    expect(result.landedCostKrw).toBe(3418);
    expect(result.targetPriceKrw).toBe(7600);
    expect(result.totalCostKrw).toBe(3418000);
  });

  it("increases cost when product height or part count increases", () => {
    const base = calculateQuote(defaultCostInputs);
    const revised = calculateQuote({ ...defaultCostInputs, heightCm: 35, partCount: 12 });

    expect(revised.unitCostCny).toBeGreaterThan(base.unitCostCny);
    expect(revised.targetPriceKrw).toBeGreaterThan(base.targetPriceKrw);
  });

  it("does not produce an invalid price at an extreme but valid margin", () => {
    const result = calculateQuote({ ...defaultCostInputs, marginRate: 0.99 });

    expect(Number.isFinite(result.targetPriceKrw)).toBe(true);
    expect(result.targetPriceKrw).toBeGreaterThan(result.landedCostKrw);
  });
});
