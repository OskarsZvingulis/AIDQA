// CSS Diff Engine: Compare two DOM snapshots element-by-element
// Produces actionable CSS-level differences

import type { DomSnapshot, DomElement } from './capture.ts';

export interface CssDiffItem {
  selector: string;
  tag: string;
  bbox: { x: number; y: number; width: number; height: number };
  text: string;
  changes: CssPropertyChange[];
}

export interface CssPropertyChange {
  property: string;
  baseline: string;
  current: string;
  category: 'typography' | 'color' | 'spacing' | 'layout' | 'border' | 'other';
}

const PROPERTY_CATEGORIES: Record<string, CssPropertyChange['category']> = {
  fontFamily: 'typography',
  fontSize: 'typography',
  fontWeight: 'typography',
  lineHeight: 'typography',
  letterSpacing: 'typography',
  textAlign: 'typography',
  textDecoration: 'typography',
  color: 'color',
  backgroundColor: 'color',
  borderColor: 'border',
  borderWidth: 'border',
  borderRadius: 'border',
  paddingTop: 'spacing',
  paddingRight: 'spacing',
  paddingBottom: 'spacing',
  paddingLeft: 'spacing',
  marginTop: 'spacing',
  marginRight: 'spacing',
  marginBottom: 'spacing',
  marginLeft: 'spacing',
  width: 'layout',
  height: 'layout',
  display: 'layout',
  position: 'layout',
};

/**
 * Match elements between baseline and current snapshots.
 * Uses selector + bounding box proximity for matching.
 */
function matchElements(
  baseline: DomSnapshot,
  current: DomSnapshot
): Array<{ baselineEl: DomElement; currentEl: DomElement }> {
  const matched: Array<{ baselineEl: DomElement; currentEl: DomElement }> = [];
  const usedCurrentIndices = new Set<number>();

  for (const bEl of baseline) {
    let bestMatch: { index: number; score: number } | null = null;

    for (let i = 0; i < current.length; i++) {
      if (usedCurrentIndices.has(i)) continue;
      const cEl = current[i];

      // Must be same tag
      if (bEl.tag !== cEl.tag) continue;

      let score = 0;

      // Exact selector match is strong signal
      if (bEl.selector === cEl.selector) score += 50;

      // Same ID is very strong
      if (bEl.id && bEl.id === cEl.id) score += 100;

      // Overlapping classes
      const commonClasses = bEl.classes.filter((c) => cEl.classes.includes(c));
      score += commonClasses.length * 10;

      // Bounding box proximity (closer = better match)
      const dx = Math.abs(bEl.bbox.x - cEl.bbox.x);
      const dy = Math.abs(bEl.bbox.y - cEl.bbox.y);
      const distance = dx + dy;
      if (distance < 50) score += 30 - distance * 0.5;
      else if (distance < 200) score += 10;

      // Similar size
      const dw = Math.abs(bEl.bbox.width - cEl.bbox.width);
      const dh = Math.abs(bEl.bbox.height - cEl.bbox.height);
      if (dw < 20 && dh < 20) score += 15;

      // Text match
      if (bEl.text && bEl.text === cEl.text) score += 20;

      if (score > 20 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { index: i, score };
      }
    }

    if (bestMatch) {
      matched.push({ baselineEl: bEl, currentEl: current[bestMatch.index] });
      usedCurrentIndices.add(bestMatch.index);
    }
  }

  return matched;
}

/**
 * Normalize a CSS value for comparison (strip insignificant differences).
 */
function normalizeValue(prop: string, value: string): string {
  if (!value) return '';
  // Normalize rgb to hex-like comparison
  let v = value.trim().toLowerCase();
  // Normalize "0px" to "0"
  v = v.replace(/\b0px\b/g, '0');
  return v;
}

/**
 * Compare two DOM snapshots and produce CSS-level diffs.
 */
export function compareDomSnapshots(
  baseline: DomSnapshot,
  current: DomSnapshot
): CssDiffItem[] {
  if (!baseline.length || !current.length) return [];

  const matched = matchElements(baseline, current);
  const diffs: CssDiffItem[] = [];

  for (const { baselineEl, currentEl } of matched) {
    const changes: CssPropertyChange[] = [];

    // Compare all style properties
    const allProps = new Set([
      ...Object.keys(baselineEl.styles),
      ...Object.keys(currentEl.styles),
    ]);

    for (const prop of allProps) {
      const bVal = normalizeValue(prop, baselineEl.styles[prop] || '');
      const cVal = normalizeValue(prop, currentEl.styles[prop] || '');

      if (bVal !== cVal && bVal && cVal) {
        changes.push({
          property: prop.replace(/([A-Z])/g, '-$1').toLowerCase(), // camelCase to kebab-case
          baseline: baselineEl.styles[prop] || '',
          current: currentEl.styles[prop] || '',
          category: PROPERTY_CATEGORIES[prop] || 'other',
        });
      }
    }

    if (changes.length > 0) {
      diffs.push({
        selector: currentEl.selector,
        tag: currentEl.tag,
        bbox: currentEl.bbox,
        text: currentEl.text || baselineEl.text || '',
        changes,
      });
    }
  }

  // Sort by number of changes (most impactful first)
  diffs.sort((a, b) => b.changes.length - a.changes.length);

  // Limit to top 50 elements with changes
  return diffs.slice(0, 50);
}

/**
 * Generate a human-readable CSS diff summary.
 */
export function summarizeCssDiff(diffs: CssDiffItem[]): string {
  if (diffs.length === 0) return 'No CSS-level differences detected.';

  const totalChanges = diffs.reduce((sum, d) => sum + d.changes.length, 0);
  const categories = new Map<string, number>();

  for (const diff of diffs) {
    for (const change of diff.changes) {
      categories.set(change.category, (categories.get(change.category) || 0) + 1);
    }
  }

  const topCategories = [...categories.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, count]) => `${count} ${cat}`)
    .join(', ');

  return `${totalChanges} CSS property changes across ${diffs.length} elements (${topCategories}).`;
}
