// Serverless Browser Service - Remote WebSocket Browser
// Uses Browserless or similar headless browser service via WebSocket
// Compatible with Deno (no local Playwright binaries)

export interface CaptureOptions {
  url?: string;
  htmlContent?: string;
  viewport: { width: number; height: number };
  timeout?: number;
}

export async function captureScreenshot(
  options: CaptureOptions
): Promise<Uint8Array> {
  const { url, htmlContent, viewport, timeout = 30000 } = options;

  if (!url && !htmlContent) {
    throw new Error("Either url or htmlContent must be provided");
  }

  const wsEndpoint = Deno.env.get("BROWSERLESS_WS_ENDPOINT") ||
    Deno.env.get("BROWSER_WS_ENDPOINT");

  if (!wsEndpoint) {
    throw new Error(
      "BROWSERLESS_WS_ENDPOINT or BROWSER_WS_ENDPOINT environment variable is required"
    );
  }

  console.log(
    "[SCREENSHOT] Capturing via remote browser:",
    htmlContent ? "HTML content" : `URL: ${url}`
  );

  try {
    // Use Puppeteer-compatible CDP (Chrome DevTools Protocol) over WebSocket
    // This works with Browserless.io, Bright Data, or self-hosted Chrome
    
    const puppeteer = await import("https://deno.land/x/puppeteer@16.2.0/mod.ts");
    
    const browser = await puppeteer.default.connect({
      browserWSEndpoint: wsEndpoint,
    });

    const page = await browser.newPage();
    
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
    });

    // Disable animations for deterministic screenshots
    await page.evaluateOnNewDocument(() => {
      const style = document.createElement("style");
      style.innerHTML = `
        * {
          animation: none !important;
          transition: none !important;
          caret-color: transparent !important;
        }
        html { scroll-behavior: auto !important; }
      `;
      document.head.appendChild(style);
    });

    // Navigate to URL or set HTML content
    if (htmlContent) {
      await page.setContent(htmlContent, { waitUntil: "networkidle0", timeout });
    } else if (url) {
      await page.goto(url, { waitUntil: "networkidle0", timeout });
    }

    // Wait for page to settle
    await page.waitForTimeout(250);

    // Capture screenshot
    const screenshot = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    await browser.close();

    console.log("[SCREENSHOT] Captured successfully");
    
    // Convert to Uint8Array if needed
    return screenshot instanceof Uint8Array ? screenshot : new Uint8Array(screenshot);
    
  } catch (error) {
    console.error("[ERROR] Screenshot capture failed:", error);
    throw new Error(
      `Screenshot capture failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
