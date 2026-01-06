import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { PNG } from 'pngjs';
import { comparePngExact, DimensionMismatchError } from '../services/comparePngExact.js';

async function writePng(filePath: string, width: number, height: number, pixelFn: (x: number, y: number) => [number, number, number, number]) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const [r, g, b, a] = pixelFn(x, y);
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, PNG.sync.write(png));
}

describe('comparePngExact', () => {
  it('PASS when identical', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aidqa-visual-'));
    const baselinePath = path.join(dir, 'baseline.png');
    const currentPath = path.join(dir, 'current.png');
    const diffPath = path.join(dir, 'diff.png');

    await writePng(baselinePath, 2, 2, () => [10, 20, 30, 255]);
    await writePng(currentPath, 2, 2, () => [10, 20, 30, 255]);

    const res = await comparePngExact({ baselinePath, currentPath, diffPath });

    expect(res.pass).toBe(true);
    expect(res.mismatchPixelCount).toBe(0);
    expect(res.totalPixels).toBe(4);
    expect(res.mismatchPercent).toBe(0);

    const diffBuf = await fs.readFile(diffPath);
    const diff = PNG.sync.read(diffBuf);
    // diff should be fully transparent
    expect(Array.from(diff.data).every((v, i) => (i % 4 === 3 ? v === 0 : true))).toBe(true);
  });

  it('FAIL when one pixel differs (mismatchPixelCount = 1)', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aidqa-visual-'));
    const baselinePath = path.join(dir, 'baseline.png');
    const currentPath = path.join(dir, 'current.png');
    const diffPath = path.join(dir, 'diff.png');

    await writePng(baselinePath, 2, 2, (x, y) => (x === 0 && y === 0 ? [0, 0, 0, 255] : [10, 20, 30, 255]));
    await writePng(currentPath, 2, 2, (x, y) => (x === 0 && y === 0 ? [1, 0, 0, 255] : [10, 20, 30, 255]));

    const res = await comparePngExact({ baselinePath, currentPath, diffPath });

    expect(res.pass).toBe(false);
    expect(res.mismatchPixelCount).toBe(1);
    expect(res.totalPixels).toBe(4);
    expect(res.mismatchPercent).toBeCloseTo(25);
  });

  it('throws DIMENSION_MISMATCH when dimensions differ', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aidqa-visual-'));
    const baselinePath = path.join(dir, 'baseline.png');
    const currentPath = path.join(dir, 'current.png');
    const diffPath = path.join(dir, 'diff.png');

    await writePng(baselinePath, 2, 2, () => [0, 0, 0, 255]);
    await writePng(currentPath, 3, 2, () => [0, 0, 0, 255]);

    await expect(comparePngExact({ baselinePath, currentPath, diffPath })).rejects.toBeInstanceOf(
      DimensionMismatchError
    );
  });
});
