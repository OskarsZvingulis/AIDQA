import type { DomElement } from '../_lib/types.ts'

const BROWSERLESS_URL = Deno.env.get('BROWSERLESS_URL') ?? 'https://chrome.browserless.io'
const BROWSERLESS_API_KEY = Deno.env.get('BROWSERLESS_API_KEY') ?? ''

export async function captureScreenshot(url: string): Promise<Uint8Array> {
  const endpoint = `${BROWSERLESS_URL}/screenshot?token=${BROWSERLESS_API_KEY}`

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000)

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          options: { type: 'png', fullPage: false },
          viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
          gotoOptions: { waitUntil: 'networkidle2', timeout: 15000 },
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) throw new Error(`Browserless screenshot failed: ${response.status}`)

      const buffer = new Uint8Array(await response.arrayBuffer())
      if (buffer.length < 1000) throw new Error('Screenshot appears blank')

      return buffer
    } catch (err) {
      if (attempt === 3) throw err
      await new Promise(r => setTimeout(r, attempt * 1000))
    }
  }

  throw new Error('Screenshot capture failed after 3 attempts')
}

export async function captureDomSnapshot(url: string): Promise<DomElement[]> {
  const endpoint = `${BROWSERLESS_URL}/function?token=${BROWSERLESS_API_KEY}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      context: { url },
      code: `
        module.exports = async ({ page, context }) => {
          await page.setViewport({ width: 1440, height: 900 });
          await page.goto(context.url, { waitUntil: 'networkidle2', timeout: 15000 });

          return await page.evaluate(() => {
            const STYLE_PROPS = [
              'color', 'backgroundColor', 'fontSize', 'fontWeight', 'lineHeight',
              'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
              'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
              'borderRadius', 'borderColor', 'borderWidth',
              'cursor', 'display', 'gap', 'opacity', 'visibility',
              'alignItems', 'justifyContent', 'flexDirection',
            ];

            const isVisible = (el) => {
              const s = window.getComputedStyle(el);
              return s.display !== 'none' && s.visibility !== 'hidden'
                && s.opacity !== '0' && el.offsetWidth > 0;
            };

            const isInteractive = (el) => {
              const tag = el.tagName.toLowerCase();
              const role = el.getAttribute('role');
              const cursor = window.getComputedStyle(el).cursor;
              return ['a', 'button', 'input', 'select', 'textarea'].includes(tag)
                || ['button', 'link', 'checkbox', 'radio', 'menuitem'].includes(role)
                || cursor === 'pointer';
            };

            return [...document.querySelectorAll('*')]
              .filter(el => isVisible(el))
              .map(el => {
                const rect = el.getBoundingClientRect();
                const computed = window.getComputedStyle(el);
                const styles = {};
                for (const prop of STYLE_PROPS) styles[prop] = computed[prop];
                return {
                  tag: el.tagName.toLowerCase(),
                  id: el.id || null,
                  classes: [...el.classList].slice(0, 5),
                  role: el.getAttribute('role') || null,
                  ariaLabel: el.getAttribute('aria-label') || null,
                  boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                  computedStyles: styles,
                  textContent: (el.textContent || '').trim().slice(0, 100),
                  isInteractive: isInteractive(el),
                  tagDepth: el.closest('body')
                    ? el.closest('body').querySelectorAll(':scope *').length : 0,
                };
              })
              .filter(el => el.boundingBox.width > 0 && el.boundingBox.height > 0);
          });
        };
      `,
    }),
    signal: controller.signal,
  })

  clearTimeout(timeout)

  if (!response.ok) throw new Error(`Browserless DOM snapshot failed: ${response.status}`)
  return response.json()
}
