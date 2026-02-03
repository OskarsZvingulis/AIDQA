// Visual Regression API route handlers

import { getSupabaseServer } from '../_lib/supabaseServer.ts';
import { uploadFile, getSignedUrl, downloadFile } from '../_lib/storage.ts';
import { isUrlSafe } from '../_lib/ssrfGuard.ts';
import type {
  Baseline,
  Run,
  CreateBaselineRequest,
  CreateRunRequest,
  APIError,
} from '../_lib/types.ts';
import { captureScreenshot } from './capture.ts';
import { comparePngExact } from './diff.ts';
import { generateAIInsights } from '../_lib/openai.ts';

// ============================================================================
// Baseline Handlers
// ============================================================================

export async function handleCreateBaseline(req: Request): Promise<Response> {
  const body: CreateBaselineRequest = await req.json();
  const { projectId, name, url, viewport = { width: 1440, height: 900 } } = body;

  if (!projectId || !name || !url) {
    return jsonError('projectId, name, and url are required', 400);
  }

  // SSRF protection
  const urlCheck = isUrlSafe(url);
  if (!urlCheck.safe) {
    return jsonError(urlCheck.error || 'URL not allowed', 400);
  }

  const supabase = getSupabaseServer();

  try {
    // Capture baseline screenshot
    console.log('[BASELINE] Capturing screenshot for:', url);
    const screenshotBytes = await captureScreenshot({ url, viewport });

    // Generate baseline ID and storage path
    const baselineId = crypto.randomUUID();
    const baselinePath = `${projectId}/baselines/${baselineId}/baseline.png`;

    // Upload to Supabase Storage
    await uploadFile(baselinePath, screenshotBytes, 'image/png');

    // Insert into database
    const { data, error } = await supabase
      .from('visual_baselines')
      .insert({
        id: baselineId,
        project_id: projectId,
        name,
        url,
        viewport,
        baseline_path: baselinePath,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }

    // Generate signed URL for response
    const baselineUrl = await getSignedUrl(baselinePath);

    const baseline: Baseline = {
      id: data.id,
      projectId: data.project_id,
      name: data.name,
      url: data.url,
      viewport: data.viewport,
      createdAt: data.created_at,
      baselinePath: data.baseline_path,
      baselineUrl,
    };

    return jsonResponse(baseline, 201);
  } catch (error: any) {
    console.error('[BASELINE] Create failed:', error);
    return jsonError(error.message || 'Failed to create baseline', 500);
  }
}

export async function handleListBaselines(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');

  if (!projectId) {
    return jsonError('projectId query parameter is required', 400);
  }

  const supabase = getSupabaseServer();

  try {
    const { data, error } = await supabase
      .from('visual_baselines')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Generate signed URLs for all baselines
    const baselines: Baseline[] = await Promise.all(
      (data || []).map(async (row) => ({
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        url: row.url,
        viewport: row.viewport,
        createdAt: row.created_at,
        baselinePath: row.baseline_path,
        baselineUrl: await getSignedUrl(row.baseline_path),
      }))
    );

    return jsonResponse(baselines);
  } catch (error: any) {
    console.error('[BASELINE] List failed:', error);
    return jsonError(error.message || 'Failed to list baselines', 500);
  }
}

// ============================================================================
// Run Handlers
// ============================================================================

export async function handleCreateRun(req: Request, baselineId: string): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    // Parse request body for optional URL override
    const body = await req.json().catch(() => ({}));
    const runUrl = typeof body.url === 'string' && body.url.trim() ? body.url.trim() : null;

    // Fetch baseline
    const { data: baselineData, error: baselineError } = await supabase
      .from('visual_baselines')
      .select('*')
      .eq('id', baselineId)
      .single();

    if (baselineError || !baselineData) {
      return jsonError('Baseline not found', 404);
    }

    const baseline = baselineData;

    // Determine which URL to capture for comparison
    const defaultUrl = baseline.url || null;
    const captureUrl = runUrl ?? defaultUrl;

    if (!captureUrl) {
      return jsonError('url is required for runs when baseline is Figma or when you want to compare against a different site', 400);
    }

    // SSRF check on capture URL
    const urlCheck = isUrlSafe(captureUrl);
    if (!urlCheck.safe) {
      return jsonError(urlCheck.error || 'URL not allowed', 400);
    }

    // Capture current screenshot from the specified URL
    console.log('[RUN] Capturing current screenshot for:', captureUrl);
    const currentBytes = await captureScreenshot({
      url: captureUrl,
      viewport: baseline.viewport,
    });

    // Download baseline screenshot
    console.log('[RUN] Downloading baseline from storage');
    const baselineBytes = await downloadFile(baseline.baseline_path);

    // Compare and generate diff
    console.log('[RUN] Computing pixel diff');
    const diffResult = await comparePngExact(baselineBytes, currentBytes);

    // Generate run ID and storage paths
    const runId = crypto.randomUUID();
    const currentPath = `${baseline.project_id}/baselines/${baselineId}/runs/${runId}/current.png`;
    const diffPath = diffResult.diffPngBytes
      ? `${baseline.project_id}/baselines/${baselineId}/runs/${runId}/diff.png`
      : null;
    const resultPath = `${baseline.project_id}/baselines/${baselineId}/runs/${runId}/result.json`;

    // Upload current screenshot
    await uploadFile(currentPath, currentBytes, 'image/png');

    // Upload diff if differences exist
    if (diffResult.diffPngBytes && diffPath) {
      await uploadFile(diffPath, diffResult.diffPngBytes, 'image/png');
    }

    // Generate signed URLs for AI analysis
    const baselineUrl = await getSignedUrl(baseline.baseline_path);
    const currentUrl = await getSignedUrl(currentPath);
    const diffUrl = diffPath ? await getSignedUrl(diffPath) : null;

    // Generate AI insights (REQUIRED - will throw if OPENAI_API_KEY missing)
    console.log('[RUN] Generating AI insights (required)');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    let aiInsights;
    try {
      aiInsights = await generateAIInsights({
        baselineUrl,
        currentUrl,
        diffUrl,
        mismatchPercentage: diffResult.mismatchPercentage,
        diffPixels: diffResult.diffPixels,
        baselineSourceUrl: baseline.url ?? null,
        currentSourceUrl: captureUrl,
        duplicationAllowed: false,
      });
    } catch (e: any) {
      clearTimeout(timeout);
      const errorMsg = e?.message ?? String(e);
      const errorStack = e?.stack ?? '';
      console.error('[RUN] AI analysis failed (required):', errorMsg, errorStack);
      
      // Insert failed run into database
      await supabase
        .from('visual_runs')
        .insert({
          id: runId,
          baseline_id: baselineId,
          project_id: baseline.project_id,
          status: 'failed',
          mismatch_percentage: diffResult.mismatchPercentage,
          diff_pixels: diffResult.diffPixels,
          current_path: currentPath,
          diff_path: diffPath,
          result_path: resultPath,
          current_source_url: captureUrl,
          ai_json: { error: errorMsg, stack: errorStack },
        });
      
      return jsonError(`AI analysis failed: ${errorMsg}`, 500);
    } finally {
      clearTimeout(timeout);
    }

    // Upload result JSON
    const resultJson = {
      mismatchPercentage: diffResult.mismatchPercentage,
      diffPixels: diffResult.diffPixels,
      baselineUrl,
      currentUrl,
      diffUrl,
      ai: aiInsights,
    };
    const resultBytes = new TextEncoder().encode(JSON.stringify(resultJson, null, 2));
    await uploadFile(resultPath, resultBytes, 'application/json');

    // Insert run into database
    const { data: runData, error: runError } = await supabase
      .from('visual_runs')
      .insert({
        id: runId,
        baseline_id: baselineId,
        project_id: baseline.project_id,
        status: 'completed',
        mismatch_percentage: diffResult.mismatchPercentage,
        diff_pixels: diffResult.diffPixels,
        current_path: currentPath,
        diff_path: diffPath,
        result_path: resultPath,
        current_source_url: captureUrl,
        ai_json: aiInsights,
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Database insert failed: ${runError.message}`);
    }

    const run: Run = {
      id: runData.id,
      baselineId: runData.baseline_id,
      projectId: runData.project_id,
      createdAt: runData.created_at,
      status: runData.status,
      mismatchPercentage: parseFloat(runData.mismatch_percentage),
      diffPixels: runData.diff_pixels,
      currentPath: runData.current_path,
      diffPath: runData.diff_path,
      resultPath: runData.result_path,
      aiJson: runData.ai_json,
      currentUrl,
      diffUrl,
      baselineUrl,
      currentSourceUrl: captureUrl,
      ai: {
        enabled: true,
        data: runData.ai_json,
      },
    };

    return jsonResponse(run, 201);
  } catch (error: any) {
    console.error('[RUN] Create failed:', error);
    return jsonError(error.message || 'Failed to create run', 500);
  }
}

export async function handleListRuns(baselineId: string): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    const { data, error } = await supabase
      .from('visual_runs')
      .select('*')
      .eq('baseline_id', baselineId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Generate signed URLs for all runs
    const runs: Run[] = await Promise.all(
      (data || []).map(async (row) => {
        const currentUrl = await getSignedUrl(row.current_path);
        const diffUrl = row.diff_path ? await getSignedUrl(row.diff_path) : null;

        return {
          id: row.id,
          baselineId: row.baseline_id,
          projectId: row.project_id,
          createdAt: row.created_at,
          status: row.status,
          mismatchPercentage: parseFloat(row.mismatch_percentage),
          diffPixels: row.diff_pixels,
          currentPath: row.current_path,
          diffPath: row.diff_path,
          resultPath: row.result_path,
          aiJson: row.ai_json,
          currentUrl,
          diffUrl,
        };
      })
    );

    return jsonResponse(runs);
  } catch (error: any) {
    console.error('[RUN] List failed:', error);
    return jsonError(error.message || 'Failed to list runs', 500);
  }
}

export async function handleGetRun(
  baselineId: string,
  runId: string
): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    const { data: runData, error: runError } = await supabase
      .from('visual_runs')
      .select('*')
      .eq('id', runId)
      .eq('baseline_id', baselineId)
      .single();

    if (runError || !runData) {
      return jsonError('Run not found', 404);
    }

    // Fetch baseline for baseline URL
    const { data: baselineData } = await supabase
      .from('visual_baselines')
      .select('baseline_path')
      .eq('id', baselineId)
      .single();

    // Generate signed URLs
    const currentUrl = await getSignedUrl(runData.current_path);
    const diffUrl = runData.diff_path ? await getSignedUrl(runData.diff_path) : null;
    const baselineUrl = baselineData?.baseline_path
      ? await getSignedUrl(baselineData.baseline_path)
      : undefined;

    const run: Run = {
      id: runData.id,
      baselineId: runData.baseline_id,
      projectId: runData.project_id,
      createdAt: runData.created_at,
      status: runData.status,
      mismatchPercentage: parseFloat(runData.mismatch_percentage),
      diffPixels: runData.diff_pixels,
      currentPath: runData.current_path,
      diffPath: runData.diff_path,
      resultPath: runData.result_path,
      aiJson: runData.ai_json,
      currentUrl,
      diffUrl,
      baselineUrl,
    };

    return jsonResponse(run);
  } catch (error: any) {
    console.error('[RUN] Get failed:', error);
    return jsonError(error.message || 'Failed to get run', 500);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status = 500): Response {
  const error: APIError = { error: message };
  return new Response(JSON.stringify(error), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
