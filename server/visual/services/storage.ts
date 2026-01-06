import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { VisualBaseline, VisualRunResult } from '../types.js';
import {
  BASELINE_INDEX_PATH,
  VISUAL_ROOT,
  baselineMetaPath,
  baselinePngPath,
  projectBaselinesIndexPath,
  runResultJsonPath,
} from './paths.js';

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  if (!existsSync(filePath)) return fallback;
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

async function writeJsonFile(filePath: string, data: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function initVisualStorage() {
  await ensureDir(VISUAL_ROOT);
  // Create baseline index file if missing
  if (!existsSync(BASELINE_INDEX_PATH)) {
    await writeJsonFile(BASELINE_INDEX_PATH, {});
  }
}

export async function saveBaselineMeta(baseline: VisualBaseline) {
  await initVisualStorage();

  // Per-baseline meta
  await writeJsonFile(baselineMetaPath(baseline.projectId, baseline.baselineId), baseline);

  // Global baseline index
  const baselineIndex = await readJsonFile<Record<string, VisualBaseline>>(BASELINE_INDEX_PATH, {});
  baselineIndex[baseline.baselineId] = baseline;
  await writeJsonFile(BASELINE_INDEX_PATH, baselineIndex);

  // Per-project baselines list
  const projectIndexPath = projectBaselinesIndexPath(baseline.projectId);
  const projectBaselines = await readJsonFile<VisualBaseline[]>(projectIndexPath, []);
  const without = projectBaselines.filter((b) => b.baselineId !== baseline.baselineId);
  without.unshift(baseline);
  await writeJsonFile(projectIndexPath, without);
}

export async function getBaselineById(baselineId: string): Promise<VisualBaseline | null> {
  await initVisualStorage();
  const baselineIndex = await readJsonFile<Record<string, VisualBaseline>>(BASELINE_INDEX_PATH, {});
  return baselineIndex[baselineId] ?? null;
}

export async function listBaselines(projectId: string): Promise<VisualBaseline[]> {
  await initVisualStorage();
  return readJsonFile<VisualBaseline[]>(projectBaselinesIndexPath(projectId), []);
}

export async function ensureBaselineFolder(projectId: string, baselineId: string) {
  await ensureDir(path.dirname(baselinePngPath(projectId, baselineId)));
}

export async function saveRunResult(projectId: string, baselineId: string, result: VisualRunResult) {
  await writeJsonFile(runResultJsonPath(projectId, baselineId, result.runId), result);
}

export async function getRunResult(projectId: string, baselineId: string, runId: string): Promise<VisualRunResult | null> {
  const p = runResultJsonPath(projectId, baselineId, runId);
  if (!existsSync(p)) return null;
  return readJsonFile<VisualRunResult>(p, null as unknown as VisualRunResult);
}

export async function listRunsForBaseline(projectId: string, baselineId: string): Promise<VisualRunResult[]> {
  const runsDir = path.join(path.dirname(runResultJsonPath(projectId, baselineId, 'x')), '..');
  if (!existsSync(runsDir)) return [];
  const entries = await fs.readdir(runsDir);
  const results: VisualRunResult[] = [];
  for (const runId of entries) {
    const result = await getRunResult(projectId, baselineId, runId);
    if (result) results.push(result);
  }
  // most recent first
  results.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return results;
}
