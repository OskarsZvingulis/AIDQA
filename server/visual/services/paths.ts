import path from 'node:path';

export const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
export const VISUAL_ROOT = path.join(STORAGE_ROOT, 'visual');

export function projectRoot(projectId: string) {
  return path.join(VISUAL_ROOT, projectId);
}

export function baselineRoot(projectId: string, baselineId: string) {
  return path.join(projectRoot(projectId), baselineId);
}

export function baselinePngPath(projectId: string, baselineId: string) {
  return path.join(baselineRoot(projectId, baselineId), 'baseline.png');
}

export function baselineMetaPath(projectId: string, baselineId: string) {
  return path.join(baselineRoot(projectId, baselineId), 'baseline.meta.json');
}

export function runRoot(projectId: string, baselineId: string, runId: string) {
  return path.join(baselineRoot(projectId, baselineId), 'runs', runId);
}

export function runCurrentPngPath(projectId: string, baselineId: string, runId: string) {
  return path.join(runRoot(projectId, baselineId, runId), 'current.png');
}

export function runDiffPngPath(projectId: string, baselineId: string, runId: string) {
  return path.join(runRoot(projectId, baselineId, runId), 'diff.png');
}

export function runResultJsonPath(projectId: string, baselineId: string, runId: string) {
  return path.join(runRoot(projectId, baselineId, runId), 'result.json');
}

export const BASELINE_INDEX_PATH = path.join(VISUAL_ROOT, 'baselineIndex.json');
export function projectBaselinesIndexPath(projectId: string) {
  return path.join(projectRoot(projectId), 'baselines.json');
}

export function toPublicStoragePath(absPath: string): string {
  const normalizedAbs = path.resolve(absPath);
  const normalizedStorage = path.resolve(STORAGE_ROOT);
  if (!normalizedAbs.startsWith(normalizedStorage + path.sep) && normalizedAbs !== normalizedStorage) {
    throw new Error('Path is outside storage root');
  }
  const rel = path.relative(STORAGE_ROOT, normalizedAbs).split(path.sep).join('/');
  return `/storage/${rel}`;
}
