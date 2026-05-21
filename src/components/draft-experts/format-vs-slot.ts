/** Format player value ÷ slot points as a percentage (100% = met slot). */
export function formatVsSlotRatio(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function vsSlotRatioMeetsBar(ratio: number): boolean {
  return ratio >= 1;
}
