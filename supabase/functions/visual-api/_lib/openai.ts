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

  const messages = [
    {
      role: 'system',
      content: `You are a design QA assistant analyzing visual regression test results. 
Your job is to examine baseline, current, and diff screenshots to identify UX issues, layout problems, and visual inconsistencies.

IMPORTANT: If the baseline and current screenshots appear to be completely different pages/products/websites (not just different versions of the same page), you MUST explicitly state this in your summary and verdict. Say something like: "These appear to be entirely different pages/websites, not intended to match" or "Baseline and current are unrelated products/pages".

Provide actionable recommendations in a structured JSON format.`,
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyze this visual regression test:
- Mismatch: ${mismatchPercentage.toFixed(2)}% (${diffPixels} pixels)
- Baseline source URL: ${baselineSourceUrl ?? 'unknown'}
- Current source URL: ${currentSourceUrl ?? 'unknown'}
- Baseline (expected): see image 1
- Current (actual): see image 2
${diffUrl ? '- Diff highlights: see image 3' : ''}

If the URLs are completely different domains/websites, state clearly that these are unrelated pages and not intended to match.
Otherwise, identify layout shifts, spacing changes, typography issues, color mismatches, missing elements, overflow, or alignment problems.`,
        },
        {
          type: 'image_url',
          image_url: { url: baselineUrl },
        },
        {
          type: 'image_url',
          image_url: { url: currentUrl },
        },
      ],
    },
  ];

  if (diffUrl) {
    messages[1].content.push({
      type: 'image_url',
      image_url: { url: diffUrl },
    });
  }

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
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'visual_regression_insights',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                summary: {
                  type: 'string',
                  description: 'Brief summary of what changed and overall assessment',
                },
                severity: {
                  type: 'string',
                  enum: ['pass', 'minor', 'major', 'fail'],
                  description: 'Overall severity: pass (acceptable), minor (cosmetic), major (breaking), fail (completely different pages)',
                },
                issues: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      type: {
                        type: 'string',
                        enum: ['layout', 'spacing', 'typography', 'color', 'missing_element', 'overflow', 'alignment', 'other'],
                      },
                      severity: {
                        type: 'string',
                        enum: ['minor', 'major'],
                      },
                      evidence: { type: 'string' },
                      recommendation: { type: 'string' },
                    },
                    required: ['title', 'type', 'severity', 'evidence', 'recommendation'],
                    additionalProperties: false,
                  },
                },
                quickWins: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Quick actionable fixes',
                },
                verdict: {
                  type: 'string',
                  description: 'Final verdict: are these pages related? Same product/website or completely different?',
                },
              },
              required: ['summary', 'severity', 'issues', 'quickWins', 'verdict'],
              additionalProperties: false,
            },
          },
        },
        max_tokens: 2000,
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
