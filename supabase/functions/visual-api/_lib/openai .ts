// OpenAI API integration for AI-powered visual regression insights
// Uses OpenAI Responses API with structured output

import type { AIInsights } from "../_lib/types.ts";

export async function generateAIInsights(opts: {
  baselineUrl: string;
  currentUrl: string;
  diffUrl: string | null;
  mismatchPercentage: number;
  diffPixels: number;
  baselineSourceUrl?: string | null;
  currentSourceUrl?: string | null;
}): Promise<AIInsights> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

  // Log configuration for debugging
  console.log("[AI] Config check:", {
    hasKey: !!OPENAI_API_KEY,
    model: OPENAI_MODEL,
  });

  if (!OPENAI_API_KEY) {
    const error = "OPENAI_API_KEY environment variable is required";
    console.error("[AI]", error);
    throw new Error(error);
  }

  const {
    baselineUrl,
    currentUrl,
    diffUrl,
    mismatchPercentage,
    diffPixels,
    baselineSourceUrl,
    currentSourceUrl,
  } = opts;

  console.log("[AI] Generating insights for", {
    mismatchPercentage,
    diffPixels,
  });

  const systemPrompt = `You are an expert Visual QA Engineer performing a REGRESSION TEST.

## THE TASK
Compare TWO SCREENSHOTS of the SAME webpage taken at DIFFERENT TIMES:
- **BASELINE**: The APPROVED/EXPECTED state (what the page SHOULD look like)
- **CURRENT**: The ACTUAL state NOW (what the page CURRENTLY looks like)
- **DIFF**: Pixel difference heatmap (RED areas = changed pixels)

Your job: Find what REGRESSED (changed for the worse) between baseline → current.

## ⚠️ THE GOLDEN RULE (CRITICAL)
The DIFF image is ONLY a locator tool to find changed areas. It contains visual artifacts!

When pixels shift position, the diff shows "ghosting" - a doubled/smeared appearance where:
- The OLD position appears as one ghost
- The NEW position appears as another ghost

**THE CURRENT IMAGE IS THE SINGLE SOURCE OF TRUTH FOR ACTUAL CONTENT.**

| Diff Shows | Current Shows | Classification |
|------------|---------------|----------------|
| Doubled/ghosted text | Single text | ✅ LAYOUT SHIFT (element moved) |
| Doubled/ghosted text | Actually doubled text | ⚠️ DUPLICATE CONTENT (real bug) |
| Red highlight | No visible difference | ✅ SUB-PIXEL NOISE (ignore) |

## ANALYSIS WORKFLOW
1. **LOCATE**: Scan the DIFF image for red hotspots
2. **VERIFY**: Check those EXACT areas in BASELINE vs CURRENT
3. **CLASSIFY**: Determine if it's a shift, change, addition, removal, or noise
4. **DESCRIBE**: What specifically changed (baseline had X, current has Y)

## MISMATCH INTERPRETATION
Pixel mismatch: ${mismatchPercentage.toFixed(2)}%
- **<0.1%**: Sub-pixel rendering noise (anti-aliasing, font smoothing) → likely "pass"
- **0.1-1%**: Minor styling changes (slight color shift, 1-3px movements)
- **1-5%**: Noticeable changes (spacing, font weight, element resize)
- **>5%**: Major changes (layout shift, missing/added elements, redesign)

## SEVERITY CLASSIFICATION
- **critical**: Broken layout, overlapping/unreadable text, missing critical components (CTA, nav), brand violations
- **major**: Noticeable regressions users WILL see (wrong colors, wrong spacing, font changes, misalignment >5px)
- **minor**: Subtle changes users might not notice (1-5px shifts, slight padding tweaks)
- **pass**: No meaningful regression OR only imperceptible sub-pixel noise

## ISSUE TYPES
- **layout**: Element moved position, changed size, responsive breakage
- **spacing**: Margins/padding increased or decreased
- **typography**: Font family, size, weight, or line-height changed
- **color**: Background, text, border, or fill color changed
- **content**: Text wording changed, image swapped, element added/removed
- **missing_element**: Component that existed in baseline is gone in current

## WHAT TO REPORT
✅ Elements that MOVED (specify direction and approximate pixels)
✅ Elements that CHANGED appearance (color, size, font)
✅ Elements ADDED in current (not in baseline)
✅ Elements REMOVED from current (was in baseline)
✅ Overlapping or broken layouts

## WHAT NOT TO REPORT
❌ "Duplicate content" when diff shows ghosting but current shows single content
❌ Sub-pixel anti-aliasing differences
❌ Identical content appearing in both images (that's expected!)
❌ Compression artifacts or rendering engine differences

## OUTPUT REQUIREMENTS
- Be SPECIFIC: "Hero button shifted 15px down" not "button issue"
- Provide EVIDENCE: "Baseline shows 20px margin, current shows 8px"
- Give ACTIONABLE fixes: "Restore margin-top: 20px on .hero-cta"
- Empty issues array is valid when mismatch is just noise
- If images are completely unrelated pages, set severity="critical" and explain`;

  // Build user content with explicitly labeled images
  const userContent: any[] = [
    {
      type: "text",
      text: `## Visual Regression Test Analysis

**Pixel Mismatch:** ${mismatchPercentage.toFixed(2)}% (${diffPixels.toLocaleString()} pixels differ)
**Page URL:** ${baselineSourceUrl ?? currentSourceUrl ?? "unknown"}

The following images are provided in order:`,
    },
    {
      type: "text",
      text: "**IMAGE 1 - BASELINE (Expected/Approved State):**",
    },
    {
      type: "image_url",
      image_url: { url: baselineUrl, detail: "high" },
    },
    {
      type: "text",
      text: "**IMAGE 2 - CURRENT (Actual State Now):**",
    },
    {
      type: "image_url",
      image_url: { url: currentUrl, detail: "high" },
    },
  ];

  if (diffUrl) {
    userContent.push(
      {
        type: "text",
        text: "**IMAGE 3 - DIFF (Red = Changed Pixels):**",
      },
      {
        type: "image_url",
        image_url: { url: diffUrl, detail: "high" },
      },
    );
  }

  userContent.push({
    type: "text",
    text: `Analyze what CHANGED between baseline and current. Report only genuine visual regressions. Return JSON.`,
  });

  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userContent,
    },
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        max_tokens: 1500,
        temperature: 0.3, // Lower = more precise/consistent
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "visual_qa_report",
            strict: true,
            schema: {
              type: "object",
              properties: {
                summary: {
                  type: "string",
                  description:
                    'One sentence: what regressed between baseline and current (or "No visual regressions detected")',
                },
                severity: {
                  type: "string",
                  enum: ["pass", "minor", "major", "critical"],
                  description:
                    "Overall regression severity based on worst issue found",
                },
                issues: {
                  type: "array",
                  description:
                    "List of visual REGRESSIONS (changes from baseline to current). Empty array if no regressions.",
                  items: {
                    type: "object",
                    properties: {
                      title: {
                        type: "string",
                        description:
                          'What changed, e.g. "Header logo shifted right" or "Button color darkened"',
                      },
                      location: {
                        type: "string",
                        description: "Where on page this regression occurs",
                      },
                      type: {
                        type: "string",
                        enum: [
                          "spacing",
                          "typography",
                          "color",
                          "layout",
                          "content",
                          "missing_element",
                          "other",
                        ],
                        description:
                          "spacing=margins/padding changed, typography=font changed, color=fills/borders changed, layout=position/size changed, content=text/image changed, missing_element=component removed",
                      },
                      severity: {
                        type: "string",
                        enum: ["minor", "major", "critical"],
                      },
                      evidence: {
                        type: "string",
                        description:
                          "Describe what you see: baseline shows X, current shows Y",
                      },
                      recommendation: {
                        type: "string",
                        description: "How to fix: restore X from baseline",
                      },
                    },
                    required: [
                      "title",
                      "location",
                      "type",
                      "severity",
                      "evidence",
                      "recommendation",
                    ],
                    additionalProperties: false,
                  },
                },
                quickWins: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Simple fixes to restore baseline appearance. Empty array if no issues.",
                },
              },
              required: ["summary", "severity", "issues", "quickWins"],
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

    // Log raw response for debugging
    console.log(
      "[AI] Raw response:",
      JSON.stringify(
        {
          model: data.model,
          usage: data.usage,
          finishReason: data.choices?.[0]?.finish_reason,
          content: content,
        },
        null,
        2,
      ),
    );

    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    const insights: AIInsights = JSON.parse(content);
    console.log("[AI] Parsed insights:", {
      severity: insights.severity,
      issueCount: insights.issues.length,
      issues: insights.issues.map((i) => `${i.severity}: ${i.title}`),
      summary: insights.summary,
    });

    return insights;
  } catch (error: any) {
    console.error("[AI] Failed to generate insights:", error);
    // AI is required - throw error instead of returning null
    throw new Error(`OpenAI API failed: ${error.message || String(error)}`);
  }
}
