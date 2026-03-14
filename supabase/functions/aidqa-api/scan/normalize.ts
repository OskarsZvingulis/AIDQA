// @deno-types="https://deno.land/x/imagescript@1.2.15/mod.d.ts"
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts'

export async function normalizeImage(input: Uint8Array): Promise<Uint8Array> {
  const img = await Image.decode(input)

  if (img.width !== 1440) {
    const scale = 1440 / img.width
    img.resize(1440, Math.round(img.height * scale))
  }

  if (img.height > 6000) {
    img.crop(0, 0, 1440, 6000)
  }

  return img.encode() as unknown as Uint8Array
}

export async function generateOverlay(
  normalizedImageBytes: Uint8Array,
  findings: Array<{
    severity: string
    evidence_type: string
    evidence: Record<string, unknown>
  }>
): Promise<Uint8Array> {
  const img = await Image.decode(normalizedImageBytes)

  const SEVERITY_COLORS: Record<string, [number, number, number]> = {
    critical: [220, 38, 38],
    high: [234, 88, 12],
    medium: [202, 138, 4],
    low: [37, 99, 235],
  }

  for (const finding of findings) {
    const [r, g, b] = SEVERITY_COLORS[finding.severity] ?? [100, 100, 100]
    const color = Image.rgbToColor(r, g, b)

    if (finding.evidence_type === 'bbox') {
      const ev = finding.evidence as { x: number; y: number; width: number; height: number }
      drawRect(img, ev.x, ev.y, ev.width, ev.height, color, 3)
    } else if (finding.evidence_type === 'multi_bbox') {
      const ev = finding.evidence as { boxes: Array<{ x: number; y: number; width: number; height: number }> }
      for (const box of ev.boxes) {
        drawRect(img, box.x, box.y, box.width, box.height, color, 2)
      }
    }
  }

  return img.encode() as unknown as Uint8Array
}

function drawRect(img: Image, x: number, y: number, w: number, h: number, color: number, thickness: number) {
  const ix = Math.max(0, Math.round(x))
  const iy = Math.max(0, Math.round(y))
  const iw = Math.min(img.width - ix, Math.round(w))
  const ih = Math.min(img.height - iy, Math.round(h))

  for (let t = 0; t < thickness; t++) {
    // Top edge
    for (let px = ix; px < ix + iw; px++) {
      if (iy + t < img.height) img.setPixelAt(px + 1, iy + t + 1, color)
    }
    // Bottom edge
    for (let px = ix; px < ix + iw; px++) {
      if (iy + ih - t - 1 < img.height) img.setPixelAt(px + 1, iy + ih - t, color)
    }
    // Left edge
    for (let py = iy; py < iy + ih; py++) {
      if (ix + t < img.width) img.setPixelAt(ix + t + 1, py + 1, color)
    }
    // Right edge
    for (let py = iy; py < iy + ih; py++) {
      if (ix + iw - t - 1 < img.width) img.setPixelAt(ix + iw - t, py + 1, color)
    }
  }
}
