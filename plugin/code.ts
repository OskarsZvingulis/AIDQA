// Simple Figma plugin main script for AIDQA
// Note: We keep typings light here to avoid requiring external figma type packages.

import { analyzeDesign } from '../src/core/analyzer';
import { defaultDesignSystem } from '../src/core/defaultDesignSystem';
import type { DesignNode, AnalyzeResult } from '../src/core/types';

declare const figma: any;

declare const __html__: string | undefined;

// Lightweight SceneNode type alias for compilation in plugin build
type SceneNode = any;

// Inline minimal UI HTML (kept in plugin/ui.html as well for convenience).
const UI_HTML = `<!DOCTYPE html><html><body><script>/* UI placeholder - actual UI is in plugin/ui.html */</script></body></html>`;

// Utility: convert Figma Paint to our Paint[] representation (first solid fill only)
function paintToFill(paint: any) {
  if (!paint) return null;
  if (paint.type === 'SOLID' && paint.color) {
    return {
      type: 'SOLID' as const,
      color: { r: paint.color.r, g: paint.color.g, b: paint.color.b },
    };
  }
  return null;
}

function serializeNode(node: any): DesignNode {
  const base: DesignNode = {
    id: node.id,
    name: node.name || node.id,
    type: node.type,
  } as DesignNode;

  // fills
  try {
    const fills = node.fills as any[] | undefined;
    if (fills && fills.length > 0) {
      const firstSolid = fills.find(f => f.type === 'SOLID');
      if (firstSolid) base.fills = [{ type: 'SOLID', color: firstSolid.color }];
    }
  } catch (e) {
    // ignore
  }

  // spacing - itemSpacing for auto-layout frames
  try {
    if (typeof node.itemSpacing === 'number') {
      base.spacing = node.itemSpacing;
    }
  } catch (e) {}

  // text-specific
  try {
    if (node.type === 'TEXT') {
      // fontSize - may be number or array
      if (typeof node.fontSize === 'number') base.fontSize = node.fontSize;
      else if (typeof node.fontSize === 'object' && node.fontSize !== null && typeof node.fontSize.value === 'number') base.fontSize = node.fontSize.value;

      // textStyle - best effort: use style name if available
      try {
        if (node.getStyledText) {
          // no-op - keep generic
        }
      } catch (e) {}

      if (node.style && node.style.fontFamily) {
        // fallback mapping
        base.textStyle = node.style.fontFamily;
      }

      // foregroundColor: take text fills
      try {
        const textFills = node.fills;
        if (textFills && textFills.length > 0) {
          const s = textFills.find((f: any) => f.type === 'SOLID');
          if (s) base.foregroundColor = { r: s.color.r, g: s.color.g, b: s.color.b };
        }
      } catch (e) {}
    }
  } catch (e) {}

  // componentName for instances
  try {
    if (node.type === 'INSTANCE' && node.mainComponent) {
      if (node.mainComponent && node.mainComponent.name) base.componentName = node.mainComponent.name;
    }
  } catch (e) {}

  // borderRadius - single value
  try {
    if (typeof node.cornerRadius === 'number') base.borderRadius = node.cornerRadius;
    else if (node.rectangleCornerRadius && typeof node.rectangleCornerRadius === 'number') base.borderRadius = node.rectangleCornerRadius;
  } catch (e) {}

  // iconSize heuristic
  try {
    if (node.type === 'VECTOR' || (node.name && node.name.toLowerCase().includes('icon'))) {
      if (typeof node.width === 'number') base.iconSize = Math.round(node.width);
    }
  } catch (e) {}

  // backgroundColor heuristic: check fills on parent if available
  try {
    if (node.type === 'TEXT') {
      const parent = node.parent;
      if (parent && parent.fills) {
        const pfill = parent.fills.find((f: any) => f.type === 'SOLID');
        if (pfill) base.backgroundColor = { r: pfill.color.r, g: pfill.color.g, b: pfill.color.b };
      }
    }
  } catch (e) {}

  // children
  try {
    if (node.children && Array.isArray(node.children)) {
      base.children = node.children.map((c: any) => serializeNode(c));
    }
  } catch (e) {}

  return base;
}

function getRootNodeForAnalysis(selection: readonly SceneNode[]): DesignNode | null {
  if (!selection || selection.length === 0) return null;
  return serializeNode(selection[0]);
}

// Show UI (use plugin/ui.html content if available in manifest; fallback to inline)
figma.showUI(UI_HTML || '', { width: 380, height: 560 });

figma.ui.onmessage = (msg: any) => {
  if (msg?.type === 'scan-selection') {
    const sel = figma.currentPage.selection as readonly SceneNode[];
    const root = getRootNodeForAnalysis(sel);

    if (!root) {
      figma.ui.postMessage({ type: 'scan-result', error: 'Please select a frame or node before scanning.' });
      return;
    }

    // Run analysis using the core engine and default design system
    try {
      const result: AnalyzeResult = analyzeDesign(root as any, defaultDesignSystem as any);
      figma.ui.postMessage({ type: 'scan-result', payload: result });
    } catch (err: any) {
      figma.ui.postMessage({ type: 'scan-result', error: String(err?.message || err) });
    }
  }
};
