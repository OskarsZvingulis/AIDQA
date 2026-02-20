// Screenshot capture using Browserless REST API (lightweight)
// Uses HTTP endpoint instead of WebSocket to avoid Edge Function size limits

import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';
import type { Viewport } from '../_lib/types.ts';

const DEFAULT_VIEWPORT: Viewport = { width: 1440, height: 900 };

interface CaptureSettings {
  waitForTimeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  waitForSelector?: string;
}

export async function captureScreenshot(opts: {
  url: string;
  viewport?: Viewport;
  captureSettings?: CaptureSettings;
}): Promise<Uint8Array> {
  const { url, viewport = DEFAULT_VIEWPORT, captureSettings = {} } = opts;

  const browserlessEndpoint = Deno.env.get('BROWSERLESS_REST_ENDPOINT');
  const browserlessApiKey = Deno.env.get('BROWSERLESS_API_KEY');
  
  if (!browserlessEndpoint) {
    throw new Error('BROWSERLESS_REST_ENDPOINT not configured. Set to https://chrome.browserless.io');
  }

  console.log('[SCREENSHOT] Capturing:', url, 'via Browserless REST API');

  const maxRetries = 3;
  const retryDelays = [300, 900, 2000]; // Exponential backoff
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await captureScreenshotAttempt(url, viewport, captureSettings, browserlessEndpoint, browserlessApiKey);
    } catch (error: any) {
      lastError = error;
      const shouldRetry = 
        error.message.includes('Screenshot capture failed: 5') || // 5xx errors
        error.message.includes('blank/white'); // Blank screenshot
      
      if (shouldRetry && attempt < maxRetries - 1) {
        const delay = retryDelays[attempt];
        console.warn(`[SCREENSHOT] Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }

  throw lastError || new Error('Screenshot capture failed after retries');
}

async function captureScreenshotAttempt(
  url: string,
  viewport: Viewport,
  captureSettings: CaptureSettings,
  browserlessEndpoint: string,
  browserlessApiKey: string | undefined
): Promise<Uint8Array> {
  // Use Browserless HTTP screenshot API with proper wait for JS-heavy pages
  // Docs: https://docs.browserless.io/screenshot
  const screenshotUrl = `${browserlessEndpoint}/screenshot${browserlessApiKey ? `?token=${browserlessApiKey}` : ''}`;
  
  const requestBody: any = {
    url,
    viewport: {
      width: viewport.width,
      height: viewport.height,
    },
    gotoOptions: {
      waitUntil: captureSettings.waitUntil || 'networkidle2',
    },
    waitForTimeout: captureSettings.waitForTimeout || 3000,
    options: {
      type: 'png',
      fullPage: false,
    },
  };

  // Add optional waitForSelector if provided
  if (captureSettings.waitForSelector) {
    requestBody.waitForSelector = {
      selector: captureSettings.waitForSelector,
      timeout: 10000,
    };
  }

  const response = await fetch(screenshotUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Screenshot capture failed: ${response.status} ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const pngBytes = new Uint8Array(arrayBuffer);

  // Guard against blank/white screenshots with optimized grid sampling
  try {
    const image = await Image.decode(pngBytes);
    let whitePixelCount = 0;
    let sampledPixels = 0;

    // Sample grid - approximately 3000-5000 pixels total
    const stepX = Math.max(1, Math.floor(image.width / 60));
    const stepY = Math.max(1, Math.floor(image.height / 50));

    for (let y = 0; y < image.height; y += stepY) {
      for (let x = 0; x < image.width; x += stepX) {
        const color = image.getPixelAt(x, y);
        // Check if pixel is near-white (RGB > 250)
        const r = (color >> 24) & 0xFF;
        const g = (color >> 16) & 0xFF;
        const b = (color >> 8) & 0xFF;
        if (r > 250 && g > 250 && b > 250) {
          whitePixelCount++;
        }
        sampledPixels++;
      }
    }

    const whitePercentage = sampledPixels > 0 ? (whitePixelCount / sampledPixels) * 100 : 0;
    console.log('[SCREENSHOT] White pixels (sampled):', whitePercentage.toFixed(2) + '%', `(${sampledPixels} samples)`);

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

// DOM snapshot element type
export interface DomElement {
  selector: string;
  tag: string;
  classes: string[];
  id: string;
  bbox: { x: number; y: number; width: number; height: number };
  styles: Record<string, string>;
  text: string;
}

export type DomSnapshot = DomElement[];

/**
 * Capture computed CSS styles for visible elements on a page.
 * Uses Browserless /function endpoint to run JS in the browser context.
 */
export async function captureDomSnapshot(opts: {
  url: string;
  viewport?: Viewport;
  captureSettings?: CaptureSettings;
}): Promise<DomSnapshot> {
  const { url, viewport = DEFAULT_VIEWPORT, captureSettings = {} } = opts;

  const browserlessEndpoint = Deno.env.get('BROWSERLESS_REST_ENDPOINT');
  const browserlessApiKey = Deno.env.get('BROWSERLESS_API_KEY');

  if (!browserlessEndpoint) {
    throw new Error('BROWSERLESS_REST_ENDPOINT not configured');
  }

  const functionUrl = `${browserlessEndpoint}/function${browserlessApiKey ? `?token=${browserlessApiKey}` : ''}`;

  // The JS code to execute in the browser context
  const browserCode = `
    export default async function({ page }) {
      await page.setViewport({ width: ${viewport.width}, height: ${viewport.height} });
      await page.goto("${url.replace(/"/g, '\\"')}", {
        waitUntil: "${captureSettings.waitUntil || 'networkidle2'}",
        timeout: 30000,
      });
      await new Promise(resolve => setTimeout(resolve, ${captureSettings.waitForTimeout || 3000}));
      ${captureSettings.waitForSelector ? `await page.waitForSelector("${captureSettings.waitForSelector.replace(/"/g, '\\"')}", { timeout: 10000 });` : ''}

      const snapshot = await page.evaluate(() => {
        const STYLE_PROPS = [
          'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
          'color', 'backgroundColor',
          'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
          'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
          'borderRadius', 'borderColor', 'borderWidth',
          'width', 'height', 'display', 'position',
          'textAlign', 'textDecoration',
        ];

        const elements = [];
        const allEls = document.querySelectorAll('body *');

        for (const el of allEls) {
          if (elements.length >= 500) break;

          const rect = el.getBoundingClientRect();
          // Skip invisible elements
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

          const computed = window.getComputedStyle(el);
          if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') continue;

          const tag = el.tagName.toLowerCase();
          // Skip non-visual elements
          if (['script', 'style', 'noscript', 'meta', 'link', 'br', 'hr'].includes(tag)) continue;

          const classes = Array.from(el.classList);
          const id = el.id || '';

          // Build selector
          let selector = tag;
          if (id) selector += '#' + id;
          else if (classes.length > 0) selector += '.' + classes.slice(0, 3).join('.');

          const styles = {};
          for (const prop of STYLE_PROPS) {
            const val = computed[prop];
            if (val) styles[prop] = val;
          }

          const text = (el.textContent || '').trim().slice(0, 100);

          elements.push({
            selector,
            tag,
            classes,
            id,
            bbox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            styles,
            text: el.childNodes.length <= 3 ? text : '',
          });
        }

        return elements;
      });

      return { data: snapshot, type: 'application/json' };
    }
  `;

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/javascript' },
      body: browserCode,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('[DOM_SNAPSHOT] Capture failed:', response.status, errorText);
      return [];
    }

    const result = await response.json();
    return (result?.data || result || []) as DomSnapshot;
  } catch (error: any) {
    console.warn('[DOM_SNAPSHOT] Capture failed (non-fatal):', error.message);
    return [];
  }
}
