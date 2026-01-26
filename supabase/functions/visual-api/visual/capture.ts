// Screenshot capture using Browserless REST API (lightweight)
// Uses HTTP endpoint instead of WebSocket to avoid Edge Function size limits

import type { Viewport } from '../_lib/types.ts';

const DEFAULT_VIEWPORT: Viewport = { width: 1440, height: 900 };
const SETTLE_MS = 250;

const DISABLE_ANIMATIONS_CSS = `
* {
  animation: none !important;
  transition: none !important;
  caret-color: transparent !important;
}
html { scroll-behavior: auto !important; }
`;

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

  // Use Browserless HTTP screenshot API (much lighter than WebSocket + puppeteer-core)
  // Docs: https://docs.browserless.io/screenshot
  const screenshotUrl = `${browserlessEndpoint}/screenshot${browserlessApiKey ? `?token=${browserlessApiKey}` : ''}`;
  
  const response = await fetch(screenshotUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      options: {
        type: 'png',
        fullPage: false,
      },
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Screenshot capture failed: ${response.status} ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

