// PNG perceptual comparison using imagescript (Deno-native) + pixelmatch
// imagescript replaces pngjs (which crashes in Deno due to Node.js dependencies)

import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';
import pixelmatch from 'https://esm.sh/pixelmatch@6.0.0';
import type { DiffResult } from '../_lib/types.ts';

export async function comparePngExact(
  baselinePng: Uint8Array,
  currentPng: Uint8Array
): Promise<DiffResult> {
  // Decode PNGs using imagescript (pure Deno, no Node.js dependencies)
  const baselineImg = await Image.decode(baselinePng);
  const currentImg = await Image.decode(currentPng);

  const { width, height } = baselineImg;

  // Ensure dimensions match
  if (currentImg.width !== width || currentImg.height !== height) {
    throw new Error(
      `Image dimensions mismatch: baseline ${width}x${height} vs current ${currentImg.width}x${currentImg.height}`
    );
  }

  // Get raw RGBA bitmap data
  const baselineData = new Uint8ClampedArray(baselineImg.bitmap.buffer);
  const currentData = new Uint8ClampedArray(currentImg.bitmap.buffer);

  // Create diff image
  const diffImg = new Image(width, height);
  const diffData = new Uint8ClampedArray(diffImg.bitmap.buffer);

  // pixelmatch identifies which pixels differ — color is overridden by two-tone pass below
  const mismatchPixels = pixelmatch(
    baselineData,
    currentData,
    diffData,
    width,
    height,
    {
      threshold: 0.1,        // 0-1, higher = more tolerant (0.1 = ignore <10% color diff)
      alpha: 0.1,            // ignore alpha channel differences
      includeAA: true,       // ignore anti-aliasing artifacts
      diffColor: [255, 0, 0] // placeholder — overridden below
    }
  );

  const totalPixels = width * height;
  const mismatchPercentage = totalPixels > 0 ? (mismatchPixels / totalPixels) * 100 : 0;

  let diffPngBytes: Uint8Array | null = null;
  if (mismatchPixels > 0) {
    // Two-tone diff: green = baseline-only pixels, red = current-only pixels.
    // pixelmatch flagged differing pixels with alpha > 0 in diffData.
    // We walk those and assign color based on which source image has more visible content.
    for (let i = 0; i < diffData.length; i += 4) {
      if (diffData[i + 3] === 0) continue; // unchanged pixel, skip

      // Luminance of each source at this pixel (0 if fully transparent)
      const bA = baselineData[i + 3];
      const cA = currentData[i + 3];
      const baselineLum = bA > 0
        ? 0.299 * baselineData[i] + 0.587 * baselineData[i + 1] + 0.114 * baselineData[i + 2]
        : 0;
      const currentLum = cA > 0
        ? 0.299 * currentData[i] + 0.587 * currentData[i + 1] + 0.114 * currentData[i + 2]
        : 0;

      if (baselineLum > currentLum) {
        // Baseline pixel is more visible here → green
        diffData[i]     = 0;
        diffData[i + 1] = 200;
        diffData[i + 2] = 0;
      } else {
        // Current pixel is more visible here → red
        diffData[i]     = 220;
        diffData[i + 1] = 0;
        diffData[i + 2] = 0;
      }
      diffData[i + 3] = 200; // consistent alpha, visible but not fully opaque
    }

    new Uint8ClampedArray(diffImg.bitmap.buffer).set(diffData);
    diffPngBytes = await diffImg.encode();
  }

  return {
    diffPixels: mismatchPixels,
    mismatchPercentage: parseFloat(mismatchPercentage.toFixed(4)),
    diffPngBytes,
  };
}