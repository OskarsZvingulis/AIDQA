import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

export class DimensionMismatchError extends Error {
  readonly code = 'DIMENSION_MISMATCH' as const;
  constructor(message = 'PNG dimensions do not match') {
    super(message);
    this.name = 'DimensionMismatchError';
  }
}

export async function comparePngExact(opts: {
  baselinePath: string;
  currentPath: string;
  diffPath: string;
}): Promise<{
  mismatchPixelCount: number;
  totalPixels: number;
  mismatchPercent: number;
  pass: boolean;
}> {
  const { baselinePath, currentPath, diffPath } = opts;

  if (!existsSync(baselinePath)) {
    throw new Error(`Baseline PNG not found: ${baselinePath}`);
  }
  if (!existsSync(currentPath)) {
    throw new Error(`Current PNG not found: ${currentPath}`);
  }

  const [baselineBuf, currentBuf] = await Promise.all([
    fs.readFile(baselinePath),
    fs.readFile(currentPath),
  ]);

  const baseline = PNG.sync.read(baselineBuf);
  const current = PNG.sync.read(currentBuf);

  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new DimensionMismatchError(
      `Baseline is ${baseline.width}x${baseline.height} but current is ${current.width}x${current.height}`
    );
  }

  const width = baseline.width;
  const height = baseline.height;
  const totalPixels = width * height;

  const diff = new PNG({ width, height });
  // default transparent
  diff.data.fill(0);

  let mismatchPixelCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;

      const br = baseline.data[idx];
      const bg = baseline.data[idx + 1];
      const bb = baseline.data[idx + 2];
      const ba = baseline.data[idx + 3];

      const cr = current.data[idx];
      const cg = current.data[idx + 1];
      const cb = current.data[idx + 2];
      const ca = current.data[idx + 3];

      const mismatch = br !== cr || bg !== cg || bb !== cb || ba !== ca;
      if (mismatch) {
        mismatchPixelCount++;
        // highlight mismatched pixel in opaque red
        diff.data[idx] = 255;
        diff.data[idx + 1] = 0;
        diff.data[idx + 2] = 0;
        diff.data[idx + 3] = 255;
      }
    }
  }

  await fs.mkdir(path.dirname(diffPath), { recursive: true });
  await fs.writeFile(diffPath, PNG.sync.write(diff));

  const pass = mismatchPixelCount === 0;
  const mismatchPercent = totalPixels === 0 ? 0 : (mismatchPixelCount / totalPixels) * 100;

  return {
    mismatchPixelCount,
    totalPixels,
    mismatchPercent,
    pass,
  };
}
