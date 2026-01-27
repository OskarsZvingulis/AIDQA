// OpenAI API integration for AI-powered visual regression insights
// Uses OpenAI Responses API with structured output

import type { AIInsights } from '../_lib/types.ts';

export async function generateAIInsights(opts: {
  baselineUrl: string;
  currentUrl: string;
  diffUrl: string | null;
  mismatchPercentage: number;
  diffPixels: number;
  baselineSourceUrl?: string | null;
  currentSourceUrl?: string | null;
}): Promise<AIInsights> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

  // Log configuration for debugging
  console.log('[AI] Config check:', { 
    hasKey: !!OPENAI_API_KEY,
    model: OPENAI_MODEL 
  });

  if (!OPENAI_API_KEY) {
    const error = 'OPENAI_API_KEY environment variable is required';
    console.error('[AI]', error);
    throw new Error(error);
  }

  const { baselineUrl, currentUrl, diffUrl, mismatchPercentage, diffPixels, baselineSourceUrl, currentSourceUrl } = opts;

  console.log('[AI] Generating insights for', { mismatchPercentage, diffPixels });

  const systemPrompt = `You are an expert visual QA engineer analyzing UI regression test results.

CONTEXT:
- You're comparing a BASELINE screenshot (reference/expected) vs CURRENT screenshot (actual)
- A DIFF image highlights the changed pixels in red
- Mismatch percentage: ${mismatchPercentage.toFixed(2)}%

YOUR JOB:
Identify SPECIFIC UI defects with precision. For each issue, state:

1. WHAT changed (be specific with measurements if possible)
   - "Logo shifted 10-15px to the right"
   - "Button padding reduced from ~12px to ~8px"
   - "Font changed from bold to regular weight"
   - "Background color shifted from light gray to white"
   
2. WHERE on the page (location)
   - "Header navigation bar"
   - "Hero section CTA button"
   - "Footer copyright text"

3. SEVERITY:
   - critical: Breaks functionality or brand identity (wrong logo, broken layout, text cutoff)
   - major: Noticeable visual regression (spacing off, wrong colors, alignment issues)
   - minor: Subtle differences (1-2px shifts, slight color variations)
   - pass: No meaningful visual differences or expected changes

4. RECOMMENDATION:
   - "Restore 12px padding to match design system"
   - "Use Roboto font family as specified in baseline"
   - "Correct background color to #F5F5F5"

IMPORTANT RULES:
- If baseline and current are COMPLETELY DIFFERENT PAGES (not the same website/product), set severity to "critical" and state in summary: "These are unrelated pages, not a valid comparison"
- For mismatch <0.1%: likely noise (anti-aliasing, compression), mark as "pass" unless you see clear visual issues
- For mismatch 0.1-2%: likely minor styling changes
- For mismatch >2%: likely major layout/content changes
- Prioritize issues a human user would notice (ignore imperceptible pixel shifts)
- DO NOT make up issues if you don't see them clearly in the images

OUTPUT FORMAT (JSON):
{
  "summary": "Brief 1-sentence overview of findings",
  "severity": "pass|minor|major|critical",
  "issues": [
    {
      "title": "Specific issue name",
      "location": "Where on page",
      "type": "spacing|typography|color|layout|content",
      "severity": "minor|major|critical",
      "evidence": "What you see in the diff",
      "recommendation": "How to fix it"
    }
  ],
  "quickWins": ["Easy fix 1", "Easy fix 2"] // Only if issues exist
}`;

  const userContent: any[] = [
    {
      type: 'text',
      text: `Analyze this visual regression test:

Mismatch: ${mismatchPercentage.toFixed(2)}% (${diffPixels} pixels)
Baseline URL: ${baselineSourceUrl ?? 'unknown'}
Current URL: ${currentSourceUrl ?? 'unknown'}

Provide specific, actionable QA findings in JSON format.`,
    },
    {
      type: 'image_url',
      image_url: { url: baselineUrl, detail: 'high' },
    },
    {
      type: 'image_url',
      image_url: { url: currentUrl, detail: 'high' },
    },
  ];

  if (diffUrl) {
    userContent.push({
      type: 'image_url',
      image_url: { url: diffUrl, detail: 'high' },
    });
  }

  const messages = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: userContent,
    },
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        max_tokens: 1500,
        temperature: 0.3, // Lower = more precise/consistent
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'visual_qa_report',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                summary: {
                  type: 'string',
                  description: 'Brief 1-sentence overview of findings',
                },
                severity: {
                  type: 'string',
                  enum: ['pass', 'minor', 'major', 'critical'],
                  description: 'Overall severity: pass, minor, major, or critical',
                },
                issues: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Specific issue name' },
                      location: { type: 'string', description: 'Where on page' },
                      type: {
                        type: 'string',
                        enum: ['spacing', 'typography', 'color', 'layout', 'content', 'other'],
                      },
                      severity: {
                        type: 'string',
                        enum: ['minor', 'major', 'critical'],
                      },
                      evidence: { type: 'string', description: 'What you see in the diff' },
                      recommendation: { type: 'string', description: 'How to fix it' },
                    },
                    required: ['title', 'location', 'type', 'severity', 'evidence', 'recommendation'],
                    additionalProperties: false,
                  },
                },
                quickWins: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Quick actionable fixes (only if issues exist)',
                },
              },
              required: ['summary', 'severity', 'issues', 'quickWins'],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const insights: AIInsights = JSON.parse(content);
    console.log('[AI] Generated insights:', insights.severity, insights.issues.length, 'issues');

    return insights;
  } catch (error: any) {
    console.error('[AI] Failed to generate insights:', error);
    // AI is required - throw error instead of returning null
    throw new Error(`OpenAI API failed: ${error.message || String(error)}`);
  }
}
