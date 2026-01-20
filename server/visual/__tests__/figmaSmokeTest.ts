#!/usr/bin/env node
/**
 * Figma Integration Smoke Test
 *
 * Usage:
 *   npx tsx server/visual/__tests__/figmaSmokeTest.ts
 *
 * Requirements:
 *   - Set FIGMA_ACCESS_TOKEN in .env or environment
 *   - Replace placeholders below with real Figma file key and node IDs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFigmaContent } from '../services/figma.js';
import { captureScreenshot } from '../services/captureScreenshot.js';

// Load .env if available
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');
try {
  const envPath = path.join(rootDir, '.env');
  const envContent = await fs.readFile(envPath, 'utf-8');
  envContent.split('\n').forEach((line: string) => {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch {
  // .env not found, continue with existing env vars
}

// ============================================================================
// CONFIGURATION - REPLACE THESE PLACEHOLDERS
// ============================================================================

const figmaFileKey = "REPLACE_ME"; // e.g., "abc123def456" from Figma URL
const figmaNodeIds = ["1:1"]; // REPLACE_ME - e.g., ["1:23", "2:45"]

// ============================================================================

async function main() {
  console.log('🧪 Figma Integration Smoke Test');
  console.log('================================\n');

  // 1. Validate token
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    console.error('❌ FIGMA_ACCESS_TOKEN not found in environment');
    console.error('   → Set FIGMA_ACCESS_TOKEN in .env file or export it\n');
    console.error('   Get your token from: https://www.figma.com/developers/api#access-tokens');
    process.exit(1);
  }

  // 2. Validate placeholders
  if (figmaFileKey === "REPLACE_ME") {
    console.error('❌ Please replace figmaFileKey placeholder in the script');
    console.error('   → Get file key from Figma URL: https://www.figma.com/file/<FILE_KEY>/...');
    process.exit(1);
  }

  if (figmaNodeIds[0] === "1:1" && figmaNodeIds.length === 1) {
    console.warn('⚠️  Using default node ID "1:1" - you may want to replace this');
    console.warn('   → Get node IDs from Figma: right-click element → "Copy as" → "Copy link"');
    console.warn('   → Format: "1:23" (colon, not dash)\n');
  }

  console.log(`📄 File Key: ${figmaFileKey}`);
  console.log(`🔍 Node IDs: ${figmaNodeIds.join(', ')}`);
  console.log(`🔑 Token: ${token.substring(0, 8)}...${token.substring(token.length - 4)}\n`);

  try {
    // 3. Fetch Figma content
    console.log('📡 Fetching Figma content...');
    const result = await fetchFigmaContent(figmaFileKey, figmaNodeIds, token);

    console.log(`✅ Fetched ${result.nodes.length} node(s)`);
    console.log(`📝 Combined HTML length: ${result.combinedHtml.length} chars\n`);

    if (result.nodes.length === 0) {
      console.warn('⚠️  No nodes were fetched - check your node IDs');
      process.exit(1);
    }

    if (result.combinedHtml.length < 100) {
      console.warn('⚠️  Combined HTML is very short - nodes may be empty');
    }

    // 4. Capture screenshot
    const outputDir = path.join(rootDir, 'storage', '_smoke');
    const outputPath = path.join(outputDir, 'figma-baseline.png');

    console.log('📸 Capturing screenshot...');
    await fs.mkdir(outputDir, { recursive: true });

    await captureScreenshot({
      htmlContent: result.combinedHtml,
      viewport: { width: 1440, height: 900 },
      outputPath,
    });

    console.log(`✅ Screenshot saved: ${outputPath}\n`);

    // 5. Success
    console.log('✅ OK - Figma integration smoke test passed!');
    console.log('\nNext steps:');
    console.log('  • View screenshot:', outputPath);
    console.log('  • Integrate into your visual regression workflow');
    console.log('  • See docs/FIGMA_SETUP.md for more details\n');

  } catch (error: unknown) {
    const err = error as Error;
    console.error('\n❌ Smoke test failed:', err.message);
    
    // Provide actionable hints
    if (err.message.includes('401') || err.message.includes('403')) {
      console.error('\n💡 Hint: Token invalid or no access to file');
      console.error('   → Verify token at: https://www.figma.com/developers/api#access-tokens');
      console.error('   → Ensure you have access to the Figma file');
    } else if (err.message.includes('FIGMA_ACCESS_TOKEN')) {
      console.error('\n💡 Hint: Set FIGMA_ACCESS_TOKEN in .env file');
    } else if (err.message.includes('not found')) {
      console.error('\n💡 Hint: Node IDs not found in file');
      console.error('   → Check node ID format: "1:23" (colon, not dash)');
      console.error('   → Get IDs from Figma: right-click → "Copy as" → "Copy link"');
    }
    
    console.error('');
    process.exit(1);
  }
}

main();
