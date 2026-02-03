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

  // Get raw RGBA bitmap data (Image.bitmap is already Uint8ClampedArray)
  const baselineData = baselineImg.bitmap;
  const currentData = currentImg.bitmap;

  // Run pixelmatch into a temporary mask — used only to identify which pixels differ
  const maskData = new Uint8ClampedArray(width * height * 4);
  const mismatchPixels = pixelmatch(
    baselineData,
    currentData,
    maskData,
    width,
    height,
    {
      threshold: 0.1,
      alpha: 0.1,
      includeAA: true,
      diffColor: [255, 255, 255] // doesn't matter, we only check alpha
    }
  );

  const totalPixels = width * height;
  const mismatchPercentage = totalPixels > 0 ? (mismatchPixels / totalPixels) * 100 : 0;

  let diffPngBytes: Uint8Array | null = null;
  if (mismatchPixels > 0) {
    // Two-tone diff: GREEN = baseline had content here, RED = current has content here
    const diffImg = new Image(width, height);
    const diffData = diffImg.bitmap; // Already Uint8ClampedArray

    for (let i = 0; i < maskData.length; i += 4) {
      if (maskData[i + 3] === 0) {
        // Pixel unchanged — transparent
        diffData[i]     = 0;
        diffData[i + 1] = 0;
        diffData[i + 2] = 0;
        diffData[i + 3] = 0;
        continue;
      }

      // Both pixels exist (screenshots are fully opaque).
      const bR = baselineData[i], bG = baselineData[i+1], bB = baselineData[i+2];
      const cR = currentData[i],  cG = currentData[i+1],  cB = currentData[i+2];

      // Distance between the two pixels
      const dist = Math.abs(bR - cR) + Math.abs(bG - cG) + Math.abs(bB - cB);

      if (dist < 30) {
        // Very subtle difference (anti-aliasing / sub-pixel shift)
        // Render as bright yellow — neutral indicator
        diffData[i]     = 255;  // R
        diffData[i + 1] = 230;  // G (bright yellow)
        diffData[i + 2] = 0;    // B
        diffData[i + 3] = 220;  // Alpha — highly visible
      } else {
        // Significant difference: one side is content (dark), other is background (bright)
        const bBrightness = (bR + bG + bB) / 3;
        const cBrightness = (cR + cG + cB) / 3;

        if (bBrightness < cBrightness) {
          // Baseline is darker = baseline HAD content here, current is background
          // This is where something WAS → bright saturated GREEN
          diffData[i]     = 0;    // R
          diffData[i + 1] = 255;  // G (full saturation)
          diffData[i + 2] = 50;   // B (slight cyan tint for visibility)
          diffData[i + 3] = 240;  // Alpha — almost opaque
        } else {
          // Current is darker = current HAS content here, baseline is background
          // This is where something IS NOW → bright saturated RED
          diffData[i]     = 255;  // R (full saturation)
          diffData[i + 1] = 0;    // G
          diffData[i + 2] = 50;   // B (slight magenta tint for visibility)
          diffData[i + 3] = 240;  // Alpha — almost opaque
        }
      }
    }

    diffPngBytes = await diffImg.encode();
  }

  return {
    diffPixels: mismatchPixels,
    mismatchPercentage: parseFloat(mismatchPercentage.toFixed(4)),
    diffPngBytes,
  };
}