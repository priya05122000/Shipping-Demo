import { Color } from 'three';

// The neutral tone curve (Khronos PBR Neutral) that post-processing applies to the whole picture.
const START = 0.8 - 0.04;
const D = 1 - START;
const DESATURATION = 0.15;

/**
 * The colour to draw so that the screen shows `hex` after the neutral tone
 * curve, which would otherwise shift the UI colours: it takes an offset off
 * every channel and compresses and desaturates light colours. For unlit
 * things (the floor, the background, text), whose colour goes straight to it.
 */
export function beforeNeutral(hex: string): Color {
  const c = new Color(hex);
  const rgb = [c.r, c.g, c.b];
  // Undo the compression: it scales the colour so its peak lands on max(rgb), then mixes in g of grey.
  const newPeak = Math.max(...rgb);
  if (newPeak >= START) {
    const peak = START - D + (D * D) / (1 - newPeak);
    const g = 1 - 1 / (DESATURATION * (peak - newPeak) + 1);
    for (let i = 0; i < 3; i++) rgb[i] = ((rgb[i] - g * newPeak) / (1 - g)) * (peak / newPeak);
  }
  // Undo the offset. Below 0.08 the curve takes x − 6.25x² off every channel (x the smallest); above, 0.04.
  const m = Math.min(...rgb);
  const offset = m < 0.04 ? Math.sqrt(m / 6.25) - m : 0.04;
  return new Color(rgb[0] + offset, rgb[1] + offset, rgb[2] + offset);
}
