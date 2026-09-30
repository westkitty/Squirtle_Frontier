// Bound actual render pixels, not CSS layout. Presets never alter simulation.
export const DETAIL_BUDGETS = Object.freeze({
  high: { maxRatio: 1.5, maxPixels: 2_073_600 },
  medium: { maxRatio: 1, maxPixels: 921_600 },
  low: { maxRatio: 0.75, maxPixels: 230_400 },
});
export function pixelRatioFor(quality, width, height, deviceRatio = 1) {
  const budget = DETAIL_BUDGETS[quality] || DETAIL_BUDGETS.high;
  const area = Math.max(1, width) * Math.max(1, height);
  const ratio =
    Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  return Math.min(ratio, budget.maxRatio, Math.sqrt(budget.maxPixels / area));
}
