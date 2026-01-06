import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import type { Viewport } from '../types.js';

const DEFAULT_VIEWPORT: Viewport = { width: 1440, height: 900 };

const FIXED_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
  outputPath: string;
  settleMs?: number;
}): Promise<void> {
  const { url, viewport = DEFAULT_VIEWPORT, outputPath, settleMs = 250 } = opts;

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      colorScheme: 'light',
      locale: 'en-US',
      timezoneId: 'UTC',
      userAgent: FIXED_USER_AGENT,
    });

    const page = await context.newPage();

    // Disable animations/transitions as early as possible for every document
    await page.addInitScript((cssText: string) => {
      const style = document.createElement('style');
      style.setAttribute('data-visual-regression', 'disable-animations');
      style.textContent = cssText;
      document.documentElement.appendChild(style);
    }, DISABLE_ANIMATIONS_CSS);

    await page.goto(url, { waitUntil: 'networkidle' });
    if (settleMs > 0) {
      await page.waitForTimeout(settleMs);
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await page.screenshot({
      path: outputPath,
      type: 'png',
      fullPage: false,
    });

    await context.close();
  } finally {
    await browser.close();
  }
}
