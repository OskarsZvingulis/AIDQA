import type { Finding, CategoryScores } from '../_lib/types.ts'

const WEIGHTS: Record<string, number> = { critical: 20, high: 12, medium: 7, low: 3 }

export function calculateScore(findings: Finding[]): { overall: number; categoryScores: CategoryScores } {
  let total = 100
  const categoryDeductions: Record<string, number> = {}
  const penalizedRules = new Set<string>()

  for (const finding of findings.filter(f => f.source === 'deterministic')) {
    const ruleKey = `${finding.category}:${finding.title}`
    if (penalizedRules.has(ruleKey)) continue

    const deduction = WEIGHTS[finding.severity] ?? 0
    total -= deduction
    categoryDeductions[finding.category] = (categoryDeductions[finding.category] ?? 0) + deduction
    penalizedRules.add(ruleKey)
  }

  total = Math.max(0, total)

  const categories = ['layout', 'hierarchy', 'consistency', 'accessibility', 'design_system', 'ux_readiness']
  const categoryScores: CategoryScores = {} as CategoryScores
  for (const cat of categories) {
    (categoryScores as Record<string, number>)[cat] = Math.max(0, 100 - (categoryDeductions[cat] ?? 0))
  }

  return { overall: total, categoryScores }
}

export function mergeAndPrioritize(
  deterministic: Finding[],
  ai: Finding[]
): Finding[] {
  const all = [...deterministic, ...ai]

  // Deduplicate by title similarity
  const deduped: Finding[] = []
  const titles = new Set<string>()

  for (const f of all) {
    const key = f.title.toLowerCase().slice(0, 40)
    if (titles.has(key)) continue
    titles.add(key)
    deduped.push(f)
  }

  // Sort by severity
  const weight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  deduped.sort((a, b) => (weight[b.severity] ?? 0) - (weight[a.severity] ?? 0))

  // Top 3–7
  return deduped.slice(0, 7)
}
