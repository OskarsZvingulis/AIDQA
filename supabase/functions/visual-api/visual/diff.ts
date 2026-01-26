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

  // ✅ PERCEPTUAL DIFF with tolerance (ignores tiny color shifts + anti-aliasing)
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
      diffColor: [255, 0, 0] // red highlights for diffs
    }
  );

  const totalPixels = width * height;
  const mismatchPercentage = totalPixels > 0 ? (mismatchPixels / totalPixels) * 100 : 0;

  let diffPngBytes: Uint8Array | null = null;
  if (mismatchPixels > 0) {
    // Copy diffData back to diffImg bitmap
    new Uint8ClampedArray(diffImg.bitmap.buffer).set(diffData);
    
    // Encode as PNG
    diffPngBytes = await diffImg.encode();
  }

  return {
    diffPixels: mismatchPixels,
    mismatchPercentage: parseFloat(mismatchPercentage.toFixed(4)),
    diffPngBytes,
  };
}
