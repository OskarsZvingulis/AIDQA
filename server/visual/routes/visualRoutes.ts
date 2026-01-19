import type { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { existsSync } from 'node:fs';
import {
  baselinePngPath,
  runCurrentPngPath,
  runDiffPngPath,
  runResultJsonPath,
  toPublicStoragePath,
} from '../services/paths.js';
import {
  ensureBaselineFolder,
  getBaselineById,
  getRunResult,
  listBaselines,
  listRunsForBaseline,
  saveBaselineMeta,
  saveRunResult,
} from '../services/storage.js';
import type { Viewport, VisualBaseline, VisualRunResult, FigmaSource } from '../types.js';
import { captureScreenshot } from '../services/captureScreenshot.js';
import { comparePngExact, DimensionMismatchError } from '../services/comparePngExact.js';
import { fetchFigmaContent } from '../services/figma.js';

const viewportSchema = z
  .object({ width: z.number().int().positive(), height: z.number().int().positive() })
  .strict();

const figmaSourceSchema = z.object({
  figmaFileKey: z.string().min(1),
  figmaNodeIds: z.array(z.string().min(1)),
}).strict();

const createBaselineSchema = z
  .object({
    projectId: z.string().min(1),
    name: z.string().min(1),
    url: z.string().url().optional(),
    figmaSource: figmaSourceSchema.optional(),
    viewport: viewportSchema.optional(),
  })
  .strict()
  .refine(
    (data) => data.url || data.figmaSource,
    { message: 'Either url or figmaSource must be provided' }
  );

const createRunSchema = z
  .object({
    url: z.string().url().optional(),
    figmaSource: figmaSourceSchema.optional(),
    viewport: viewportSchema.optional(),
  })
  .strict();

function normalizeViewport(viewport: Viewport | undefined): Viewport {
  return viewport ?? { width: 1440, height: 900 };
}

export function registerVisualRoutes(router: Router) {
  // (4) List baselines
  router.get('/baselines', async (req, res) => {
    const projectId = String(req.query.projectId ?? '');
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    const baselines = await listBaselines(projectId);
    return res.status(200).json(baselines);
  });

  // (1) Create baseline
  router.post('/baselines', async (req, res) => {
    const parsed = createBaselineSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    const { projectId, name, url, figmaSource } = parsed.data;
    const viewport = normalizeViewport(parsed.data.viewport as Viewport | undefined);

    const baselineId = uuidv4();
    const createdAt = new Date().toISOString();

    const baseline: VisualBaseline = {
      baselineId,
      projectId,
      name,
      url,
      figmaSource: figmaSource as FigmaSource | undefined,
      viewport,
      createdAt,
    };

    const baselinePath = baselinePngPath(projectId, baselineId);

    try {
      await ensureBaselineFolder(projectId, baselineId);

      // Fetch Figma content if figmaSource provided
      let htmlContent: string | undefined;
      if (figmaSource) {
        const token = process.env.FIGMA_ACCESS_TOKEN || '';
        const figmaResult = await fetchFigmaContent(
          figmaSource.figmaFileKey,
          figmaSource.figmaNodeIds,
          token
        );
        htmlContent = figmaResult.combinedHtml;
      }

      await captureScreenshot({ 
        url, 
        htmlContent,
        viewport, 
        outputPath: baselinePath 
      });
      await saveBaselineMeta(baseline);

      return res.status(201).json({
        baselineId,
        projectId,
        name,
        url,
        figmaSource,
        viewport,
        baselineImagePath: toPublicStoragePath(baselinePath),
        createdAt,
      });
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to create baseline' });
    }
  });

  // (5) List runs for baseline
  router.get('/baselines/:baselineId/runs', async (req, res) => {
    const baselineId = req.params.baselineId;
    const baseline = await getBaselineById(baselineId);
    if (!baseline) {
      return res.status(404).json({ error: 'Baseline not found' });
    }
    const runs = await listRunsForBaseline(baseline.projectId, baselineId);
    return res.status(200).json(runs);
  });

  // (2) Create run
  router.post('/baselines/:baselineId/runs', async (req, res) => {
    const baselineId = req.params.baselineId;
    const baseline = await getBaselineById(baselineId);
    if (!baseline) {
      return res.status(404).json({ error: 'Baseline not found' });
    }

    const parsed = createRunSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    const url = parsed.data.url ?? baseline.url;
    const figmaSource = (parsed.data.figmaSource as FigmaSource | undefined) ?? baseline.figmaSource;
    const viewport = normalizeViewport((parsed.data.viewport as Viewport | undefined) ?? baseline.viewport);

    const runId = uuidv4();
    const createdAt = new Date().toISOString();

    const baselinePath = baselinePngPath(baseline.projectId, baselineId);
    const currentPath = runCurrentPngPath(baseline.projectId, baselineId, runId);
    const diffPath = runDiffPngPath(baseline.projectId, baselineId, runId);
    const resultJsonAbs = runResultJsonPath(baseline.projectId, baselineId, runId);

    let result: VisualRunResult;

    try {
      try {
        // Fetch Figma content if figmaSource provided
        let htmlContent: string | undefined;
        if (figmaSource) {
          const token = process.env.FIGMA_ACCESS_TOKEN || '';
          const figmaResult = await fetchFigmaContent(
            figmaSource.figmaFileKey,
            figmaSource.figmaNodeIds,
            token
          );
          htmlContent = figmaResult.combinedHtml;
        }

        await captureScreenshot({ url, htmlContent, viewport, outputPath: currentPath });
      } catch (e) {
        result = {
          runId,
          baselineId,
          status: 'ERROR',
          errorCode: 'CAPTURE_FAILED',
          metrics: {
            mismatchPixelCount: 0,
            totalPixels: 0,
            mismatchPercent: 0,
          },
          artifacts: {
            baseline: toPublicStoragePath(baselinePath),
            current: existsSync(currentPath) ? toPublicStoragePath(currentPath) : '',
            diff: null,
            resultJson: toPublicStoragePath(resultJsonAbs),
          },
          createdAt,
        };
        await saveRunResult(baseline.projectId, baselineId, result);
        return res.status(201).json(result);
      }

      try {
        const metrics = await comparePngExact({
          baselinePath,
          currentPath,
          diffPath,
        });

        const status = metrics.pass ? 'PASS' : 'FAIL';

        result = {
          runId,
          baselineId,
          status,
          errorCode: null,
          metrics: {
            mismatchPixelCount: metrics.mismatchPixelCount,
            totalPixels: metrics.totalPixels,
            mismatchPercent: metrics.mismatchPercent,
          },
          artifacts: {
            baseline: toPublicStoragePath(baselinePath),
            current: toPublicStoragePath(currentPath),
            diff: toPublicStoragePath(diffPath),
            resultJson: toPublicStoragePath(resultJsonAbs),
          },
          createdAt,
        };
      } catch (e) {
        const isDimMismatch = e instanceof DimensionMismatchError;
        result = {
          runId,
          baselineId,
          status: 'ERROR',
          errorCode: isDimMismatch ? 'DIMENSION_MISMATCH' : 'COMPARE_FAILED',
          metrics: {
            mismatchPixelCount: 0,
            totalPixels: 0,
            mismatchPercent: 0,
          },
          artifacts: {
            baseline: toPublicStoragePath(baselinePath),
            current: toPublicStoragePath(currentPath),
            diff: null,
            resultJson: toPublicStoragePath(resultJsonAbs),
          },
          createdAt,
        };
      }
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to create run' });
    }

    await saveRunResult(baseline.projectId, baselineId, result);
    return res.status(201).json(result);
  });

  // (3) Get run result
  router.get('/baselines/:baselineId/runs/:runId', async (req, res) => {
    const { baselineId, runId } = req.params;
    const baseline = await getBaselineById(baselineId);
    if (!baseline) {
      return res.status(404).json({ error: 'Baseline not found' });
    }

    const result = await getRunResult(baseline.projectId, baselineId, runId);
    if (!result) {
      return res.status(404).json({ error: 'Run not found' });
    }

    return res.status(200).json(result);
  });
}
