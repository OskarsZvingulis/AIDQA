// Screenshot capture using Browserless REST API (lightweight)
// Uses HTTP endpoint instead of WebSocket to avoid Edge Function size limits

import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';
import type { Viewport } from '../_lib/types.ts';

const DEFAULT_VIEWPORT: Viewport = { width: 1440, height: 900 };

export async function captureScreenshot(opts: {
  url: string;
  viewport?: Viewport;
}): Promise<Uint8Array> {
  const { url, viewport = DEFAULT_VIEWPORT } = opts;

  const browserlessEndpoint = Deno.env.get('BROWSERLESS_REST_ENDPOINT');
  const browserlessApiKey = Deno.env.get('BROWSERLESS_API_KEY');
  
  if (!browserlessEndpoint) {
    throw new Error('BROWSERLESS_REST_ENDPOINT not configured. Set to https://chrome.browserless.io');
  }

  console.log('[SCREENSHOT] Capturing:', url, 'via Browserless REST API');

  // Use Browserless HTTP screenshot API with proper wait for JS-heavy pages
  // Docs: https://docs.browserless.io/screenshot
  const screenshotUrl = `${browserlessEndpoint}/screenshot${browserlessApiKey ? `?token=${browserlessApiKey}` : ''}`;
  
  const response = await fetch(screenshotUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
      gotoOptions: {
        waitUntil: 'networkidle2',
      },
      waitForTimeout: 3000,
      options: {
        type: 'png',
        fullPage: false,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Screenshot capture failed: ${response.status} ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const pngBytes = new Uint8Array(arrayBuffer);

  // Guard against blank/white screenshots
  try {
    const image = await Image.decode(pngBytes);
    let whitePixelCount = 0;
    const totalPixels = image.width * image.height;

    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const color = image.getPixelAt(x, y);
        // Check if pixel is near-white (RGB > 250)
        const r = (color >> 24) & 0xFF;
        const g = (color >> 16) & 0xFF;
        const b = (color >> 8) & 0xFF;
        if (r > 250 && g > 250 && b > 250) {
          whitePixelCount++;
        }
      }
    }

    const whitePercentage = (whitePixelCount / totalPixels) * 100;
    console.log('[SCREENSHOT] White pixels:', whitePercentage.toFixed(2) + '%');

    if (whitePercentage > 98) {
      throw new Error(
        `Screenshot rendered blank/white (${whitePercentage.toFixed(1)}% white). ` +
        `Page may be blocked, not loaded, or requires longer waitForTimeout. URL: ${url}`
      );
    }
  } catch (error: any) {
    if (error.message.includes('blank/white')) {
      throw error; // Re-throw blank detection errors
    }
    // If image decode fails, log but continue (screenshot might still be valid)
    console.warn('[SCREENSHOT] Failed to validate image whiteness:', error.message);
  }

  return pngBytes;
}
