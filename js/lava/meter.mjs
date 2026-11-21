// Frequency data -> VU bar heights.
//
// Kept apart from index.mjs so the only untested code in the browser client is
// DOM plumbing and the SDK call. This file is pure arithmetic.

/**
 * Collapses a frequency array into `barCount` bar heights in 0..1.
 *
 * The SDK hands back a Uint8Array of 0..255 magnitudes. Averaging each slice
 * (rather than sampling one bin) keeps the meter steady instead of flickering
 * on a single noisy bin.
 *
 * @param {ArrayLike<number>} frequencies
 * @param {number} barCount
 * @returns {number[]} one value per bar, each 0..1
 */
export function barsFromFrequencies(frequencies, barCount = 12) {
  const bars = new Array(Math.max(1, barCount)).fill(0);
  if (!frequencies || typeof frequencies.length !== 'number' || frequencies.length === 0) {
    return bars;
  }
  const perBar = frequencies.length / bars.length;
  for (let i = 0; i < bars.length; i += 1) {
    const from = Math.floor(i * perBar);
    const to = Math.max(from + 1, Math.floor((i + 1) * perBar));
    let total = 0;
    let counted = 0;
    for (let j = from; j < to && j < frequencies.length; j += 1) {
      const value = Number(frequencies[j]);
      if (Number.isFinite(value)) {
        total += value;
        counted += 1;
      }
    }
    const average = counted === 0 ? 0 : total / counted;
    // 0..255 in, 0..1 out, clamped so a stray value cannot overflow the bar.
    bars[i] = Math.min(1, Math.max(0, average / 255));
  }
  return bars;
}
