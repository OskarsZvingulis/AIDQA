import type { DomElement, Finding } from '../_lib/types.ts'

// --- Helpers ---

function parseRgb(cssColor: string): [number, number, number] | null {
  const m = cssColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!m) return null
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])]
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(...fg)
  const l2 = relativeLuminance(...bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function parsePx(value: string): number {
  const n = parseFloat(value)
  return isNaN(n) ? 0 : n
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length)
}

function mode(values: number[]): number {
  const freq: Record<number, number> = {}
  for (const v of values) freq[v] = (freq[v] ?? 0) + 1
  return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0])
}

// --- Rules ---

function checkContrast(elements: DomElement[]): Finding[] {
  const textTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'label', 'li', 'td', 'th', 'button'])
  const findings: Finding[] = []
  const seen = new Set<string>()

  for (const el of elements) {
    if (!textTags.has(el.tag)) continue
    if (!el.textContent.trim()) continue

    const fg = parseRgb(el.computedStyles.color)
    const bg = parseRgb(el.computedStyles.backgroundColor)
    if (!fg || !bg) continue

    const ratio = contrastRatio(fg, bg)
    const fontSize = parsePx(el.computedStyles.fontSize)
    const fontWeight = el.computedStyles.fontWeight
    const isLargeText = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700))
    const required = isLargeText ? 3 : 4.5

    if (ratio < required) {
      const key = `${el.computedStyles.color}|${el.computedStyles.backgroundColor}`
      if (seen.has(key)) continue
      seen.add(key)

      findings.push({
        category: 'accessibility',
        severity: ratio < 2 ? 'critical' : 'high',
        title: 'Text fails WCAG contrast requirement',
        evidence_type: 'metric',
        evidence: {
          type: 'metric',
          measured: `${ratio.toFixed(2)}:1`,
          threshold: `${required}:1 (WCAG AA${isLargeText ? ' large text' : ''})`,
          element: `${el.tag}${el.textContent.slice(0, 30)}`,
        },
        why_it_matters: 'Users with low vision cannot reliably read this text.',
        repair_guidance: `Increase contrast between text color ${el.computedStyles.color} and background ${el.computedStyles.backgroundColor} to at least ${required}:1.`,
        ai_fix_instruction: `Update the text color or background color of the ${el.tag} element to achieve at least ${required}:1 contrast ratio per WCAG AA.`,
        metric_value: `${ratio.toFixed(2)}:1 contrast ratio`,
        score_impact: -20,
        source: 'deterministic',
      })
    }
  }

  return findings.slice(0, 3)
}

function checkTouchTargets(elements: DomElement[]): Finding[] {
  const small = elements.filter(el =>
    el.isInteractive &&
    (el.boundingBox.width < 44 || el.boundingBox.height < 44) &&
    el.boundingBox.width > 0 &&
    el.boundingBox.height > 0
  )

  if (small.length === 0) return []

  return [{
    category: 'accessibility',
    severity: 'high',
    title: `${small.length} interactive element${small.length > 1 ? 's' : ''} below 44×44px touch target`,
    evidence_type: small.length === 1 ? 'bbox' : 'multi_bbox',
    evidence: small.length === 1
      ? { type: 'bbox', ...small[0].boundingBox, label: small[0].tag }
      : {
          type: 'multi_bbox',
          boxes: small.slice(0, 8).map(el => ({ ...el.boundingBox, label: el.tag })),
          description: `${small.length} interactive elements smaller than 44×44px`,
        },
    why_it_matters: 'Small targets are hard to tap on mobile and strain motor accuracy on desktop.',
    repair_guidance: 'Increase the clickable area to at least 44×44px using padding or min-width/min-height.',
    ai_fix_instruction: 'Add min-width: 44px and min-height: 44px (or equivalent padding) to all interactive elements flagged here.',
    score_impact: -12,
    source: 'deterministic',
  }]
}

function checkSpacingRhythm(elements: DomElement[]): Finding[] {
  const spacingValues: number[] = []

  for (const el of elements) {
    const vals = [
      parsePx(el.computedStyles.marginTop),
      parsePx(el.computedStyles.marginBottom),
      parsePx(el.computedStyles.gap),
    ].filter(v => v > 0)
    spacingValues.push(...vals)
  }

  if (spacingValues.length < 5) return []

  const dominant = mode(spacingValues)
  const outliers = elements.filter(el => {
    const margin = parsePx(el.computedStyles.marginTop)
    if (margin === 0) return false
    const diff = Math.abs(margin - dominant)
    return diff > 4 && diff / dominant > 0.25
  })

  if (outliers.length < 2) return []

  return [{
    category: 'layout',
    severity: 'medium',
    title: 'Inconsistent spacing rhythm',
    evidence_type: 'multi_bbox',
    evidence: {
      type: 'multi_bbox',
      boxes: outliers.slice(0, 6).map(el => ({ ...el.boundingBox })),
      description: `${outliers.length} elements break the dominant ${dominant}px spacing pattern`,
    },
    why_it_matters: 'Irregular spacing makes the layout feel unpolished and hard to scan.',
    repair_guidance: `Normalize margins and gaps to multiples of the dominant spacing value (${dominant}px).`,
    ai_fix_instruction: `Standardize vertical spacing to use consistent increments. The dominant spacing value is ${dominant}px — align outlier elements to this or a multiple of it.`,
    score_impact: -7,
    source: 'deterministic',
  }]
}

function checkButtonDrift(elements: DomElement[]): Finding[] {
  const buttons = elements.filter(el =>
    el.tag === 'button' || el.role === 'button'
  )

  if (buttons.length < 3) return []

  const radii = buttons.map(b => parsePx(b.computedStyles.borderRadius))
  const heights = buttons.map(b => b.boundingBox.height)

  if (stddev(radii) > 2 || stddev(heights) > 4) {
    return [{
      category: 'consistency',
      severity: 'medium',
      title: 'Button style inconsistency across the page',
      evidence_type: 'multi_bbox',
      evidence: {
        type: 'multi_bbox',
        boxes: buttons.slice(0, 6).map(el => ({ ...el.boundingBox })),
        description: `${buttons.length} buttons with varying border-radius or height`,
      },
      why_it_matters: 'Visually inconsistent buttons signal a lack of design system discipline.',
      repair_guidance: 'Standardize all buttons to use a single border-radius and consistent height.',
      ai_fix_instruction: 'Apply a consistent button style: same border-radius, padding, and height across all button elements.',
      score_impact: -7,
      source: 'deterministic',
    }]
  }

  return []
}

function checkHeadingScale(elements: DomElement[]): Finding[] {
  const h1 = elements.find(el => el.tag === 'h1')
  const h2 = elements.find(el => el.tag === 'h2')
  const body = elements.find(el => el.tag === 'p' || el.tag === 'span')

  if (!h1 || !body) return []

  const h1Size = parsePx(h1.computedStyles.fontSize)
  const bodySize = parsePx(body.computedStyles.fontSize)

  if (bodySize === 0) return []

  const h1Ratio = h1Size / bodySize
  if (h1Ratio < 1.5) {
    return [{
      category: 'design_system',
      severity: 'medium',
      title: 'Heading scale too weak — h1 not distinct from body text',
      evidence_type: 'metric',
      evidence: {
        type: 'metric',
        measured: `${h1Ratio.toFixed(1)}× body size`,
        threshold: '1.5× minimum for h1',
        element: 'h1 vs body text',
      },
      why_it_matters: 'A weak heading scale makes it hard to scan and understand page hierarchy.',
      repair_guidance: `Increase h1 font size to at least ${Math.round(bodySize * 1.5)}px (currently ${h1Size}px).`,
      ai_fix_instruction: `Set h1 font size to at least ${Math.round(bodySize * 1.5)}px to establish a clear visual hierarchy over body text (${bodySize}px).`,
      metric_value: `${h1Ratio.toFixed(1)}× ratio`,
      score_impact: -7,
      source: 'deterministic',
    }]
  }

  if (h2) {
    const h2Size = parsePx(h2.computedStyles.fontSize)
    const h2Ratio = h2Size / bodySize
    if (h2Ratio < 1.25) {
      return [{
        category: 'design_system',
        severity: 'low',
        title: 'h2 heading not sufficiently distinct from body text',
        evidence_type: 'metric',
        evidence: {
          type: 'metric',
          measured: `${h2Ratio.toFixed(1)}× body size`,
          threshold: '1.25× minimum for h2',
          element: 'h2 vs body text',
        },
        why_it_matters: 'Section headings blend into body copy, reducing scannability.',
        repair_guidance: `Increase h2 font size to at least ${Math.round(bodySize * 1.25)}px.`,
        ai_fix_instruction: `Increase h2 font-size to ${Math.round(bodySize * 1.25)}px or larger.`,
        metric_value: `${h2Ratio.toFixed(1)}× ratio`,
        score_impact: -3,
        source: 'deterministic',
      }]
    }
  }

  return []
}

function checkSpacingTokens(elements: DomElement[]): Finding[] {
  const values: number[] = []

  for (const el of elements) {
    const props = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'gap']
    for (const prop of props) {
      const v = parsePx(el.computedStyles[prop])
      if (v > 0 && v <= 100) values.push(v)
    }
  }

  if (values.length < 10) return []

  const nonMultiples = values.filter(v => v % 4 !== 0)
  const ratio = nonMultiples.length / values.length

  if (ratio > 0.3) {
    const offenders = [...new Set(nonMultiples)].slice(0, 5)
    return [{
      category: 'design_system',
      severity: 'medium',
      title: 'Spacing values not aligned to 4px grid',
      evidence_type: 'metric',
      evidence: {
        type: 'metric',
        measured: `${Math.round(ratio * 100)}% of spacing values`,
        threshold: 'All values should be multiples of 4px',
        element: `Offending values: ${offenders.join(', ')}px`,
      },
      why_it_matters: 'Off-grid spacing creates subtle visual inconsistency and signals missing design tokens.',
      repair_guidance: 'Round all spacing values to the nearest 4px increment.',
      ai_fix_instruction: 'Replace all padding and margin values with multiples of 4px (4, 8, 12, 16, 20, 24, 32, 40, 48, 64...).',
      metric_value: `${Math.round(ratio * 100)}% off-grid`,
      score_impact: -7,
      source: 'deterministic',
    }]
  }

  return []
}

function checkTypographyScale(elements: DomElement[]): Finding[] {
  const sizes = new Set<number>()

  for (const el of elements) {
    const size = parsePx(el.computedStyles.fontSize)
    if (size > 0) sizes.add(size)
  }

  if (sizes.size > 6) {
    return [{
      category: 'design_system',
      severity: 'low',
      title: `${sizes.size} distinct font sizes — type scale is fragmented`,
      evidence_type: 'metric',
      evidence: {
        type: 'metric',
        measured: `${sizes.size} distinct font sizes`,
        threshold: '6 or fewer for a clean type scale',
        element: `Sizes: ${[...sizes].sort((a, b) => a - b).slice(0, 8).join(', ')}px`,
      },
      why_it_matters: 'Too many font sizes signal an absence of a type system and create visual noise.',
      repair_guidance: 'Consolidate to a type scale of 6 or fewer sizes (e.g. 12, 14, 16, 20, 24, 32px).',
      ai_fix_instruction: 'Define a type scale with 6 sizes maximum and replace all font-size declarations with tokens from that scale.',
      metric_value: `${sizes.size} sizes`,
      score_impact: -3,
      source: 'deterministic',
    }]
  }

  return []
}

// --- Main export ---

export function runAllChecks(elements: DomElement[]): Finding[] {
  const all: Finding[] = [
    ...checkContrast(elements),
    ...checkTouchTargets(elements),
    ...checkSpacingRhythm(elements),
    ...checkButtonDrift(elements),
    ...checkHeadingScale(elements),
    ...checkSpacingTokens(elements),
    ...checkTypographyScale(elements),
  ]

  // Sort by severity weight
  const weight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  return all.sort((a, b) => (weight[b.severity] ?? 0) - (weight[a.severity] ?? 0))
}
