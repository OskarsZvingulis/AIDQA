import type { Finding } from './types.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const MODEL = 'claude-sonnet-4-6'

function buildPrompt(deterministicFindings: Finding[]): string {
  const alreadyFound = deterministicFindings.map(f => ({ category: f.category, title: f.title }))

  return `You are a senior product designer performing a design QA review.

## Screenshot
The attached image is a UI screenshot at 1440px desktop width.

## Already detected (deterministic checks)
The following issues were already found by automated measurement. Do NOT repeat these.
Return an empty array if you have no new findings to add.

<deterministic_findings>
${JSON.stringify(alreadyFound, null, 2)}
</deterministic_findings>

## Your task
Inspect the screenshot for design quality issues NOT already listed above.
Focus on:
- Visual hierarchy: Is there a clear primary action? Does heading structure guide the eye?
- Layout coherence: Does whitespace distribution and scan flow make sense?
- UX readiness: Are obvious states missing (error, empty, loading, validation)?
- Consistency: Anything not caught by automated checks?

Return ONLY a JSON object matching this schema. No prose before or after.

{
  "findings": [
    {
      "category": "hierarchy" | "layout" | "consistency" | "ux_readiness" | "design_system",
      "severity": "critical" | "high" | "medium" | "low",
      "title": "One-line issue label, max 60 chars",
      "evidence_type": "bbox" | "multi_bbox" | "region" | "explanation",
      "evidence": { ... matches evidence type shape },
      "why_it_matters": "How this harms coherence, trust, usability, or clarity. 1-2 sentences.",
      "repair_guidance": "Concrete human-readable fix. 1-2 sentences.",
      "ai_fix_instruction": "Instruction a developer could paste into an AI coding tool."
    }
  ]
}

Rules:
- Maximum 5 new findings. Return fewer if the UI is mostly sound.
- evidence_type "explanation" means no spatial location — use this for coherence/flow issues.
- evidence_type "region" means describe the area in words (e.g. "hero section", "navigation bar").
- For bbox/multi_bbox: coordinates are in the 1440px screenshot coordinate space.
- Severity "critical" only for accessibility failures or completely broken layouts.
- Be specific. "Button has no hover state" is better than "interactive feedback missing".`
}

export async function callClaudeVision(
  imageSignedUrl: string,
  deterministicFindings: Finding[]
): Promise<Finding[]> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: imageSignedUrl },
            },
            {
              type: 'text',
              text: buildPrompt(deterministicFindings),
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Claude API error ${response.status}: ${text}`)
  }

  const result = await response.json()
  const text = result.content?.[0]?.text ?? ''

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Claude response')

  const parsed = JSON.parse(jsonMatch[0])
  const findings: Finding[] = (parsed.findings ?? []).map((f: Finding) => ({
    ...f,
    source: 'ai' as const,
    score_impact: f.score_impact ?? undefined,
  }))

  return findings
}

export async function callClaudeRepairGuidance(
  findings: Finding[]
): Promise<Finding[]> {
  if (!ANTHROPIC_API_KEY) return findings

  const prompt = `You are a senior product designer. Below are design QA findings detected by automated analysis.
For each finding, rewrite the "repair_guidance" and "ai_fix_instruction" fields to be more specific and actionable.
Keep all other fields identical.

Return ONLY a JSON object: { "findings": [...] }

${JSON.stringify({ findings }, null, 2)}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) return findings

  const result = await response.json()
  const text = result.content?.[0]?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return findings

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return parsed.findings ?? findings
  } catch {
    return findings
  }
}
