export type CostInputs = {
  quantity: number;
  heightCm: number;
  partCount: number;
  fabricCny: number;
  embroideryCny: number;
  trimsCny: number;
  sewingDifficulty: number;
  packagingCny: number;
  logisticsCny: number;
  exchangeRate: number;
  marginRate: number;
};

export type QuoteResult = {
  materialsCny: number;
  laborCny: number;
  unitCostCny: number;
  landedCostKrw: number;
  targetPriceKrw: number;
  totalCostKrw: number;
};

export const defaultCostInputs: CostInputs = {
  quantity: 1000,
  heightCm: 23,
  partCount: 8,
  fabricCny: 7.2,
  embroideryCny: 1.4,
  trimsCny: 1.1,
  sewingDifficulty: 1.15,
  packagingCny: 1.2,
  logisticsCny: 1.8,
  exchangeRate: 190,
  marginRate: 0.55,
};

const round = (value: number) => Math.round(value * 100) / 100;

export function calculateQuote(input: CostInputs): QuoteResult {
  const sizeFactor = Math.max(0.55, input.heightCm / 23);
  const partsFactor = Math.max(0.65, input.partCount / 8);
  const materialsCny = (input.fabricCny + input.embroideryCny + input.trimsCny) * sizeFactor;
  const laborCny = (4.6 * sizeFactor * partsFactor) * input.sewingDifficulty;
  const unitCostCny = materialsCny + laborCny + input.packagingCny + input.logisticsCny;
  const landedCostKrw = unitCostCny * input.exchangeRate;
  const targetPriceKrw = landedCostKrw / Math.max(0.01, 1 - input.marginRate);
  return {
    materialsCny: round(materialsCny),
    laborCny: round(laborCny),
    unitCostCny: round(unitCostCny),
    landedCostKrw: Math.round(landedCostKrw),
    targetPriceKrw: Math.ceil(targetPriceKrw / 100) * 100,
    totalCostKrw: Math.round(Math.round(landedCostKrw) * input.quantity),
  };
}
