import { DesignNode, DesignSystem, AnalyzeResult, Issue, IssueType, ColorRGB } from './types';
import { hexToRgb, rgbToHex, findNearestNumber, stringSimilarity, contrastRatio } from './utils';

export function analyzeDesign(root: DesignNode, system: DesignSystem): AnalyzeResult {
  const issues: Issue[] = [];
  let issueCounter = 0;

  // Build flattened palette from brand + neutral
  const palette: string[] = [
    ...(system.colors.brand || []),
    ...(system.colors.neutral || []),
  ];

  const isColorInPalette = (color: ColorRGB | undefined | null) => {
    if (!color) return true;
    const hex = rgbToHex(color);
    // exact match or close match
    return palette.some(pc => {
      const prgb = hexToRgb(pc);
      if (!prgb) return false;
      const tol = 0.02; // tolerance
      return (
        Math.abs(prgb.r - color.r) < tol &&
        Math.abs(prgb.g - color.g) < tol &&
        Math.abs(prgb.b - color.b) < tol
      );
    });
  };

  const traverse = (node: DesignNode) => {
    // A) Color checks
    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID') {
        const nodeHex = rgbToHex(fill.color);
        if (!isColorInPalette(fill.color) && palette.length > 0) {
          // find nearest palette color
          let nearest = palette[0];
          let best = Infinity;
          palette.forEach(pc => {
            const pr = hexToRgb(pc);
            if (!pr) return;
            const dist = Math.sqrt(
              Math.pow(pr.r - fill.color.r, 2) +
              Math.pow(pr.g - fill.color.g, 2) +
              Math.pow(pr.b - fill.color.b, 2)
            );
            if (dist < best) {
              best = dist;
              nearest = pc;
            }
          });

          issues.push({
            id: `issue-${issueCounter++}`,
            type: 'color',
            nodeId: node.id,
            nodeName: node.name,
            description: `Color ${nodeHex} is not in the design system palette.`,
            suggestion: `Use nearest token: ${nearest}`,
          });
        }
      }
    }

    // B) Spacing checks
    if (node.spacing !== null && node.spacing !== undefined) {
      if (!system.spacingScale.includes(node.spacing) && (system.spacingScale || []).length > 0) {
        const nearest = findNearestNumber(node.spacing, system.spacingScale);
        issues.push({
          id: `issue-${issueCounter++}`,
          type: 'spacing',
          nodeId: node.id,
          nodeName: node.name,
          description: `Spacing ${node.spacing}px is not in the design system scale.`,
          suggestion: `Use ${nearest}px instead`,
        });
      }
    }

    // D) Radius checks
    if (node.borderRadius !== null && node.borderRadius !== undefined) {
      if (!system.radiusScale.includes(node.borderRadius) && (system.radiusScale || []).length > 0) {
        const nearest = findNearestNumber(node.borderRadius, system.radiusScale);
        issues.push({
          id: `issue-${issueCounter++}`,
          type: 'radius',
          nodeId: node.id,
          nodeName: node.name,
          description: `Border radius ${node.borderRadius}px is off-token.`,
          suggestion: `Use nearest radius token: ${nearest}px.`,
        });
      }
    }

    // C) Typography checks
    if (node.textStyle) {
      const styleKey = node.textStyle;
      if (!system.typography || !Object.prototype.hasOwnProperty.call(system.typography, styleKey!)) {
        // suggest best match
        const keys = Object.keys(system.typography || {});
        let bestMatch = keys[0] || '';
        let bestSim = 0;
        keys.forEach(k => {
          const sim = stringSimilarity(styleKey!, k);
          if (sim > bestSim) {
            bestSim = sim;
            bestMatch = k;
          }
        });

        issues.push({
          id: `issue-${issueCounter++}`,
          type: 'text',
          nodeId: node.id,
          nodeName: node.name,
          description: `Text style "${styleKey}" is not in the design system.`,
          suggestion: `Consider using "${bestMatch}" instead.`,
        });
      } else {
        // check font size vs token
        const token = system.typography[styleKey!];
        if (node.fontSize !== null && node.fontSize !== undefined) {
          if (Math.abs((node.fontSize || 0) - token.fontSize) > 1) {
            issues.push({
              id: `issue-${issueCounter++}`,
              type: 'text',
              nodeId: node.id,
              nodeName: node.name,
              description: `Font size ${node.fontSize}px does not match ${styleKey} font size (${token.fontSize}px).`,
              suggestion: `Use ${styleKey} font size ${token.fontSize}px to respect typography tokens.`,
            });
          }
        }

        // accessibility min body font size
        if (styleKey === 'Body' && node.fontSize !== null && node.fontSize !== undefined) {
          if (node.fontSize < system.accessibility.minBodyFontSize) {
            issues.push({
              id: `issue-${issueCounter++}`,
              type: 'accessibility',
              nodeId: node.id,
              nodeName: node.name,
              description: `Body text is smaller than minimum accessible font size (${system.accessibility.minBodyFontSize}px).`,
              suggestion: `Increase to at least ${system.accessibility.minBodyFontSize}px.`,
            });
          }
        }
      }
    } else {
      // fallback body-like rule: if fontSize exists and < minBodyFontSize, flag
      if (node.fontSize !== null && node.fontSize !== undefined) {
        if (node.fontSize < system.accessibility.minBodyFontSize) {
          issues.push({
            id: `issue-${issueCounter++}`,
            type: 'accessibility',
            nodeId: node.id,
            nodeName: node.name,
            description: `Text is smaller than minimum accessible font size (${system.accessibility.minBodyFontSize}px).`,
            suggestion: `Increase to at least ${system.accessibility.minBodyFontSize}px.`,
          });
        }
      }
    }

    // E) Component checks
    if (node.componentName && (system.components || []).length > 0) {
      if (!system.components.includes(node.componentName)) {
        issues.push({
          id: `issue-${issueCounter++}`,
          type: 'component',
          nodeId: node.id,
          nodeName: node.name,
          description: `Component "${node.componentName}" is not a standard system component.`,
          suggestion: `Replace with a standard component from the design system.`,
        });
      }
    }

    // F) Accessibility contrast checks
    if (node.foregroundColor && node.backgroundColor) {
      const contrast = contrastRatio(node.foregroundColor, node.backgroundColor);
      const min = system.accessibility?.minContrastRatio ?? 4.5;
      if (contrast < min) {
        issues.push({
          id: `issue-${issueCounter++}`,
          type: 'accessibility',
          nodeId: node.id,
          nodeName: node.name,
          description: `Contrast ratio ${contrast.toFixed(2)} is below minimum ${min}.`,
          suggestion: `Adjust colors to meet at least ${min}:1.`,
        });
      }
    }

    // G) Icon size checks
    if (node.iconSize !== null && node.iconSize !== undefined) {
      if (!system.icons.sizes.includes(node.iconSize)) {
        issues.push({
          id: `issue-${issueCounter++}`,
          type: 'component',
          nodeId: node.id,
          nodeName: node.name,
          description: `Icon size ${node.iconSize}px is not a token size.`,
          suggestion: `Use an icon token size: ${system.icons.sizes.join(', ')}.`,
        });
      }
    }

    // Traverse children
    if (node.children) {
      node.children.forEach(child => traverse(child));
    }
  };

  traverse(root);

  // Count by type
  const byType: Record<IssueType, number> = {
    spacing: 0,
    radius: 0,
    color: 0,
    text: 0,
    component: 0,
    accessibility: 0,
  };

  issues.forEach(issue => {
    byType[issue.type]++;
  });

  return {
    totalIssues: issues.length,
    byType,
    issues,
  };
}
