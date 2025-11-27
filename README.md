# AI Design Check (AIDQA)

An automated design quality assurance tool that scans design files for inconsistencies in design systems, brand standards, and accessibility.

## Project Overview

**Problem**: Design teams waste 20-30% of their time fixing inconsistencies in spacing, colors, typography, and components. Handoffs to developers are messy, and enterprises lose thousands per week on preventable design errors.

**Solution**: AI Design Check automatically analyzes design trees against design system rules and returns a list of issues with actionable suggestions.

Note: This project ships with a default design system configuration called **NorthStar Dashboard**. In the demo web UI you can edit the full design system JSON (left panel) to simulate different token sets.

## Architecture

This project is split into two main parts:

### 1. Core Module (`src/core`)

Pure TypeScript logic with **zero dependencies** on React, DOM, or Figma APIs. This module can be imported into any environment, including Figma plugins.

- **`types.ts`**: Type definitions for design nodes, design systems, and analysis results
- **`utils.ts`**: Helper functions (color conversion, contrast calculations, string similarity)
- **`analyzer.ts`**: Main `analyzeDesign()` function that performs the analysis
- **`index.ts`**: Barrel export for clean imports

The core module detects five categories of issues:
- **Spacing**: Values not in the spacing scale
- **Color**: Colors not in the design system palette
- **Text**: Text styles not in allowed styles
- **Component**: Non-standard components used
- **Accessibility**: Insufficient contrast ratios (WCAG)

### 2. Demo Web App (`src/web`)

A React + Vite application that demonstrates the core module's capabilities:
- Configure design system settings (colors, spacing, text styles, components)
- Paste JSON representing a design tree
- Run analysis and view results in a clean, filterable UI
- See issue counts by category and detailed suggestions

## How can I run this locally?

There are several ways of editing your application.

**Working locally**

If you want to work locally using your preferred IDE, clone this repo and install dependencies. The only requirement is Node.js & npm (or pnpm/yarn).

Quick start:

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

## Example Usage

### Design System Configuration

```typescript
const system: DesignSystem = {
  colors: ['#000000', '#FFFFFF', '#0A84FF', '#FF3B30'],
  spacingScale: [4, 8, 12, 16, 20, 24, 32],
  textStyles: ['H1', 'H2', 'Body', 'Caption'],
  components: ['Button/Primary', 'Input/Default', 'Card/Standard']
};
```

### Design Tree Example

```typescript
const designNode: DesignNode = {
  id: "root",
  name: "Login Screen",
  type: "FRAME",
  children: [
    {
      id: "btn-1",
      name: "Submit Button",
      type: "RECTANGLE",
      fills: [{ type: "SOLID", color: { r: 0.1, g: 0.5, b: 0.9 } }],
      spacing: 18,
      componentName: "Button/Custom"
    },
    {
      id: "txt-1",
      name: "Heading",
      type: "TEXT",
      textStyle: "Heading1",
      foregroundColor: { r: 0.5, g: 0.5, b: 0.5 },
      backgroundColor: { r: 1, g: 1, b: 1 }
    }
  ]
};
```

### Running Analysis

```typescript
import { analyzeDesign } from './src/core';

const result = analyzeDesign(designNode, system);
console.log(`Found ${result.totalIssues} issues`);
console.log(`Breakdown:`, result.byType);
```

## Future: Figma Plugin Integration

This core module is designed to be integrated into a Figma plugin. A Figma plugin can:

1. **Traverse real Figma nodes** using the Figma Plugin API
2. **Map Figma nodes** to the `DesignNode` type defined in `src/core/types.ts`
3. **Import and call** `analyzeDesign()` from the core module
4. **Display issues** in the Figma plugin UI with "Select in Figma" and "Fix automatically" actions

The separation of concerns means:
- Core logic is **testable** without Figma
- Core logic is **reusable** across web, CLI, or plugin environments
- Plugin development focuses on **UI and Figma API integration** only

## Technologies

This project is built with:

- **Core**: Pure TypeScript (no dependencies)
- **Demo UI**: React + Vite
- **Styling**: Tailwind CSS + shadcn-ui
- **Type Safety**: TypeScript throughout

## How can I deploy this project?

Build the production assets and deploy them to any static hosting provider (Vercel, Netlify, GitHub Pages, etc.).

```sh
npm run build
```

Follow your hosting provider's documentation to upload the `dist/` output or connect the repository for automatic deployments.

## Figma Plugin (AIDQA – AI Design QA)

This repository includes a simple Figma plugin demo in the `plugin/` folder.

- Build plugin:

```bash
npm run build:plugin
```

- Load into Figma:

  1. In Figma, go to Plugins → Development → Import plugin from manifest…
  2. Select `plugin/manifest.json` from this repo.
  3. Run the plugin, select a frame, and click “Scan selection”.

The plugin compiles `plugin/code.ts` to `plugin/dist/code.js` and will use `plugin/ui.html` for the sidebar UI.

