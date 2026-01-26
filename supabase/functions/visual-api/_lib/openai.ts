// OpenAI API integration for AI-powered visual regression insights
// Uses OpenAI Responses API with structured output

import type { AIInsights } from '../_lib/types.ts';

const AI_ENABLED = Deno.env.get('AI_ENABLED') !== 'false'; // default true
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o';

export async function generateAIInsights(opts: {
  baselineUrl: string;
  currentUrl: string;
  diffUrl: string | null;
  mismatchPercentage: number;
  diffPixels: number;
}): Promise<AIInsights | null> {
  if (!AI_ENABLED || !OPENAI_API_KEY) {
    console.log('[AI] Insights disabled (AI_ENABLED=false or no API key)');
    return null;
  }

  const { baselineUrl, currentUrl, diffUrl, mismatchPercentage, diffPixels } = opts;

  console.log('[AI] Generating insights for', { mismatchPercentage, diffPixels });

  const messages = [
    {
      role: 'system',
      content: `You are a design QA assistant analyzing visual regression test results. 
Your job is to examine baseline, current, and diff screenshots to identify UX issues, layout problems, and visual inconsistencies.
Provide actionable recommendations in a structured JSON format.`,
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyze this visual regression test:
- Mismatch: ${mismatchPercentage.toFixed(2)}% (${diffPixels} pixels)
- Baseline (expected): see image 1
- Current (actual): see image 2
${diffUrl ? '- Diff highlights: see image 3' : ''}

Identify layout shifts, spacing changes, typography issues, color mismatches, missing elements, overflow, or alignment problems.`,
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
                  enum: ['pass', 'minor', 'major'],
                  description: 'Overall severity: pass (acceptable), minor (cosmetic), major (breaking)',
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
              },
              required: ['summary', 'severity', 'issues', 'quickWins'],
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
  } catch (error) {
    console.error('[AI] Failed to generate insights:', error);
    // Return null instead of throwing - AI is optional
    return null;
  }
}
