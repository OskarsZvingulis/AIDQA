import type { Finding } from './types.ts'
import { encodeBase64 } from 'jsr:@std/encoding/base64'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash'

const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

function buildPrompt(deterministicFindings: Finding[]): string {
  const alreadyFound = deterministicFindings.map(f => ({ category: f.category, title: f.title }))

  return `You are a senior product designer performing a design QA review on a static UI screenshot.

## Screenshot
The attached image is a UI screenshot at 1440px desktop width.

## Already detected (deterministic checks)
The following issues were already found by automated measurement. Do NOT repeat these.
Return an empty array if you have no new findings to add.

<deterministic_findings>
${JSON.stringify(alreadyFound, null, 2)}
</deterministic_findings>

## Known design system — do NOT flag these as issues
This UI uses an intentional design system. The following are correct by design:
- Orange (#FF8B00) on the "Design QA" badge — this is a deliberate accent tag, not an error
- Blue (#2563EB) primary CTA button — this is correct brand usage
- Dark navy (#172B4D) for headings, medium gray (#5A6679) for secondary text — both are intentional
- Light gray (#F9FAFB) page background with white (#FFFFFF) card surfaces — correct

## NEVER flag these — they are invisible in a static screenshot
This is a static image. The following states DO NOT appear in screenshots and therefore cannot be evaluated. Do not report findings about any of these under any circumstances — even if you think they might be missing:
- Loading spinners, skeleton screens, progress indicators, "Scanning…" text
- Error messages, error borders, error toasts, inline validation errors
- Hover states, focus rings, active states
- Form validation feedback of any kind
- Empty states or zero-data states
- Disabled element styling when the element is interactable in code

If a finding you are drafting mentions any of the above concepts, discard it entirely.

## What to check — scoped to measurable dimensions only
Only flag issues within these dimensions, because these are the only things the scoring system measures and rewards:

**accessibility** — Color contrast only. Flag text where you are HIGHLY CONFIDENT the contrast ratio is definitively below 4.5:1 for normal text or below 3:1 for large text (≥18pt or 14pt bold). Do NOT flag borderline cases. Do NOT flag text you are uncertain about. Skip it if you are not sure — a missed finding is better than a false positive that cannot be fixed.

**hierarchy** — Is there a clear visual primary action? Does the heading scale (h1 > h2 > body) guide the eye in the correct order? Are competing elements of equal visual weight when one should dominate?

**layout** — Whitespace imbalance visible in the screenshot (one area cramped, another excessive). Elements visually misaligned with each other. Scan path that forces the eye to jump unexpectedly.

**consistency** — Interactive elements of the same type that are styled differently from each other (e.g. two buttons with different border-radius, two cards with different padding). Inconsistent spacing between repeated elements.

**design_system** — Typography that clearly breaks from the established scale (e.g. body text at 10px, heading at 48px with nothing in between). Spacing values that are visually inconsistent with the rest of the layout.

**ux_readiness** — ONLY: Is the primary action immediately obvious to a first-time visitor looking at this screenshot? Is the purpose of the page clear from the visible content alone? Do NOT flag any dynamic states here.

## Output format
Return ONLY a valid JSON object. No prose before or after. No comments.

Allowed values:
- category: hierarchy, layout, consistency, ux_readiness, design_system, accessibility
- severity: critical, high, medium, low
- evidence_type: bbox, multi_bbox, region, explanation
- For evidence_type "region": evidence = { "region": "description of area" }
- For evidence_type "explanation": evidence = { "explanation": "description" }
- For evidence_type "bbox": evidence = { "x": 0, "y": 0, "width": 100, "height": 50 }
- For evidence_type "multi_bbox": evidence = { "boxes": [{ "x": 0, "y": 0, "width": 100, "height": 50 }] }

{
  "findings": [
    {
      "category": "hierarchy",
      "severity": "high",
      "title": "One-line issue label under 60 chars",
      "evidence_type": "region",
      "evidence": { "region": "hero section" },
      "why_it_matters": "How this harms coherence, trust, usability, or clarity.",
      "repair_guidance": "Concrete human-readable fix targeting something visible in the screenshot.",
      "ai_fix_instruction": "Instruction a developer can paste into an AI coding tool to implement the fix."
    }
  ]
}

Rules:
- Maximum 5 new findings. Return fewer if the UI is mostly sound. Return an empty array if everything looks good.
- Only report a finding if you are highly confident it is a real, visible problem in this screenshot.
- Severity "critical" only for contrast failures that are definitively failing WCAG AA, or completely broken layouts.
- Be specific and scoped. "Heading font size is identical to body text, creating no hierarchy" is good. "Add animations" is not.
- Do not suggest adding new features, illustrations, or content. Only flag what is visibly broken.`
}

async function fetchWithBackoff(url: string, init: RequestInit, maxRetries = 4): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init)
    if (res.status !== 503 && res.status !== 429) return res
    if (attempt === maxRetries) return res
    const delay = (2 ** attempt) * 1000 + Math.random() * 500
    console.log(`[AI] Gemini ${res.status}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`)
    await new Promise(r => setTimeout(r, delay))
  }
  throw new Error('unreachable')
}

export async function callGeminiVision(
  imageSignedUrl: string,
  deterministicFindings: Finding[]
): Promise<Finding[]> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set')

  console.log('[AI] Fetching image for Gemini vision call')
  const imageResponse = await fetch(imageSignedUrl)
  if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`)
  const imageBytes = new Uint8Array(await imageResponse.arrayBuffer())
  const base64Image = encodeBase64(imageBytes)

  console.log('[AI] Sending vision request to Gemini, model:', MODEL)
  const response = await fetchWithBackoff(GEMINI_URL(MODEL, GEMINI_API_KEY), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Image } },
          { text: buildPrompt(deterministicFindings) },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
        temperature: 0.3,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${text}`)
  }

  const result = await response.json()
  console.log('[AI] Gemini vision response received, usage:', result.usageMetadata)
  console.log('[AI] Finish reason:', result.candidates?.[0]?.finishReason)
  const parts: Array<{ text?: string; thought?: boolean }> = result.candidates?.[0]?.content?.parts ?? []
  console.log('[AI] Parts count:', parts.length, '| thought flags:', parts.map((p: { thought?: boolean }) => !!p.thought))
  const textPart = parts.findLast((p: { text?: string; thought?: boolean }) => !p.thought && p.text) ?? parts[parts.length - 1]
  const text = textPart?.text ?? ''
  console.log('[AI] Extracted text (first 300 chars):', text.slice(0, 300))
  if (!text) throw new Error('Empty response from Gemini')

  let parsed: { findings?: unknown[] }
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    console.error('[AI] JSON.parse failed:', e, '| Raw text:', text.slice(0, 500))
    throw new Error(`Gemini returned unparseable JSON: ${e}`)
  }
  const findings: Finding[] = (parsed.findings ?? []).map((f: Finding) => ({
    ...f,
    source: 'ai' as const,
    score_impact: f.score_impact ?? undefined,
  }))

  console.log('[AI] Gemini vision findings:', findings.length, '| raw findings from model:', JSON.stringify(parsed.findings ?? []).slice(0, 500))
  return findings
}

export async function callGeminiRepairGuidance(
  findings: Finding[]
): Promise<Finding[]> {
  if (!GEMINI_API_KEY) return findings

  const prompt = `You are a senior product designer. Below are design QA findings detected by automated analysis.
For each finding, rewrite the "repair_guidance" and "ai_fix_instruction" fields to be more specific and actionable.
Keep all other fields identical.

Return ONLY a JSON object: { "findings": [...] }

${JSON.stringify({ findings }, null, 2)}`

  try {
    const response = await fetchWithBackoff(GEMINI_URL(MODEL, GEMINI_API_KEY), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 2000,
          temperature: 0.3,
        },
      }),
    })

    if (!response.ok) return findings

    const result = await response.json()
    const rParts: Array<{ text?: string; thought?: boolean }> = result.candidates?.[0]?.content?.parts ?? []
    const rTextPart = rParts.findLast((p: { text?: string; thought?: boolean }) => !p.thought && p.text) ?? rParts[rParts.length - 1]
    const text = rTextPart?.text ?? ''
    if (!text) return findings

    const parsed = JSON.parse(text)
    return parsed.findings ?? findings
  } catch {
    // Non-fatal — return original guidance
    return findings
  }
}

type PreviewChoices = { step1: string; step2: string; step3: string }

const CHOICE_LABELS: Record<string, Record<string, string>> = {
  step1: { minimal: 'Minimal & Clean — reduce noise, increase whitespace', bold: 'Bold & Impactful — stronger contrast, prominent CTA' },
  step2: { contrast: 'Fix contrast only — keep palette, enforce WCAG AA', refresh: 'Refresh the palette — suggest a modern accessible color scheme' },
  step3: { accessibility: 'Accessibility first — contrast ratios, legibility, touch targets', layout: 'Layout & hierarchy — spacing rhythm, visual flow, heading scale' },
}

export async function callGeminiDesignPreview(
  imageSignedUrl: string,
  findings: Finding[],
  choices: PreviewChoices
): Promise<{ description: string; fix_prompt: string; preview_image_bytes: null }> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set')

  const imageResponse = await fetch(imageSignedUrl)
  if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`)
  const imageBytes = new Uint8Array(await imageResponse.arrayBuffer())
  const base64Image = encodeBase64(imageBytes)

  const findingSummary = findings.map((f: Finding) => `- [${f.severity}] ${f.title}: ${f.repair_guidance}`).join('\n')

  const prompt = `You are a senior product designer reviewing a UI screenshot.

The following design issues were found:
${findingSummary}

The user wants fixes applied with these style preferences:
- Style direction: ${CHOICE_LABELS.step1[choices.step1]}
- Color approach: ${CHOICE_LABELS.step2[choices.step2]}
- Priority focus: ${CHOICE_LABELS.step3[choices.step3]}

Return ONLY a valid JSON object with this structure:
{
  "description": "2-3 sentences explaining what was changed and why it improves the design",
  "fix_prompt": "A complete, detailed prompt a developer can paste into v0, Cursor, or Lovable to implement all these fixes. Include specific CSS property names, example color values, and spacing amounts where applicable."
}`

  const response = await fetchWithBackoff(GEMINI_URL(MODEL, GEMINI_API_KEY), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Image } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
        temperature: 0.4,
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini preview error ${response.status}: ${errText}`)
  }

  const result = await response.json()
  const parts: Array<{ text?: string; thought?: boolean }> = result.candidates?.[0]?.content?.parts ?? []
  const textPart = parts.findLast((p: { text?: string; thought?: boolean }) => !p.thought && p.text)
  const text = textPart?.text ?? ''

  let description = ''
  let fix_prompt = ''
  try {
    const parsed = JSON.parse(text)
    description = parsed.description ?? ''
    fix_prompt = parsed.fix_prompt ?? ''
  } catch {
    description = text.slice(0, 300)
  }

  console.log('[PREVIEW] Generated description:', description.slice(0, 100))
  return { description, fix_prompt, preview_image_bytes: null }
}
