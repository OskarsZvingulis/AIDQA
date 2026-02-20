// Visual Regression API route handlers

import { getSupabaseServer } from '../_lib/supabaseServer.ts';
import { uploadFile, getSignedUrl, downloadFile } from '../_lib/storage.ts';
import { isUrlSafe } from '../_lib/ssrfGuard.ts';
import type {
  Run,
  DesignBaseline,
  Monitor,
  CreateMonitorRequest,
  APIError,
} from '../_lib/types.ts';
import { captureScreenshot, captureDomSnapshot } from './capture.ts';
import type { DomSnapshot } from './capture.ts';
import { comparePngExact } from './diff.ts';
import { compareDomSnapshots } from './cssDiff.ts';
import { generateAIInsights } from '../_lib/openai.ts';

function filterAIIssues(
  issues: unknown,
  diffStats: { mismatchPercentage: number; diffPixels: number }
): unknown {
  if (!Array.isArray(issues)) return issues;

  const layoutShift = diffStats.mismatchPercentage < 20 && diffStats.diffPixels > 10000;
  if (!layoutShift) return issues;

  return issues.map((issue: any) => {
    const blob = [
      issue?.title,
      issue?.description,
      issue?.evidence,
      issue?.recommendation,
      issue?.location,
      issue?.details,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const isDuplicationClaim =
      blob.includes('duplicate') ||
      blob.includes('duplicated') ||
      blob.includes('appears twice') ||
      blob.includes('shown twice') ||
      blob.includes('repeated') ||
      blob.includes('double text') ||
      blob.includes('text duplication');

    if (isDuplicationClaim) {
      return {
        ...issue,
        type: 'layout',
        severity: 'minor',
        title: 'Layout shift detected',
        evidence:
          'Text moved between baseline and current; diff overlay can look like doubled text.',
        recommendation: 'Check CSS/layout shifts (fonts, container width, flex/grid).',
      };
    }
    return issue;
  });
}

// ============================================================================
// Baseline Handlers
// ============================================================================

export async function handleListBaselines(req: Request, userId: string): Promise<Response> {
  const projectId = userId;
  const supabase = getSupabaseServer();

  try {
    const { data, error } = await supabase
      .from('design_baselines')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    const baselines: DesignBaseline[] = await Promise.all(
      (data || []).map(async (row) => {
        const snapshotUrl = row.snapshot_path
          ? await getSignedUrl(row.snapshot_path)
          : undefined;
        return {
          id: row.id,
          projectId: row.project_id,
          name: row.name,
          sourceType: row.source_type,
          snapshotPath: row.snapshot_path,
          snapshotUrl,
          viewport: row.viewport,
          approved: row.approved,
          approvedAt: row.approved_at,
          createdAt: row.created_at,
        };
      })
    );

    return jsonResponse(baselines);
  } catch (error: any) {
    console.error('[BASELINE] List failed:', error);
    return jsonError(error.message || 'Failed to list baselines', 500);
  }
}

// ============================================================================
// Design Baseline Handlers (New Implementation)
// ============================================================================

export async function handleCreateDesignBaseline(req: Request, userId: string): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    const body = await req.json();
    const {
      name,
      sourceUrl,
      viewport = { width: 1440, height: 900 },
      diffThresholdPct = 0.2,
      ignoreRegions = [],
    } = body;
    const projectId = userId;

    // Validation
    if (!name || !sourceUrl) {
      return jsonError('name and sourceUrl are required', 400);
    }

    // SSRF protection
    const urlCheck = isUrlSafe(sourceUrl);
    if (!urlCheck.safe) {
      return jsonError(urlCheck.error || 'URL not allowed', 400);
    }

    // 1. Capture screenshot from sourceUrl
    console.log('[DESIGN_BASELINE] Capturing screenshot for:', sourceUrl);
    const screenshotBytes = await captureScreenshot({
      url: sourceUrl,
      viewport,
      captureSettings: {},
    });

    // 2. Generate baseline ID and storage path
    const baselineId = crypto.randomUUID();
    const snapshotPath = `${projectId}/baselines/${baselineId}/baseline.png`;

    // 3. Upload to Supabase Storage
    await uploadFile(snapshotPath, screenshotBytes, 'image/png');

    // Generate signed preview URL for the uploaded snapshot
    const previewUrl = await getSignedUrl(snapshotPath);

    // Capture DOM snapshot for future CSS diff comparisons (non-fatal)
    let baselineDomPath: string | null = null;
    try {
      const domSnapshot = await captureDomSnapshot({ url: sourceUrl, viewport, captureSettings: {} });
      if (domSnapshot.length > 0) {
        const domPath = `${projectId}/baselines/${baselineId}/baseline-dom.json`;
        await uploadFile(domPath, new TextEncoder().encode(JSON.stringify(domSnapshot)), 'application/json');
        baselineDomPath = domPath;
        console.log('[DESIGN_BASELINE] DOM snapshot captured:', domSnapshot.length, 'elements');
      }
    } catch (e: any) {
      console.warn('[DESIGN_BASELINE] DOM snapshot capture failed (non-fatal):', e.message);
    }

    // 4. Insert into design_baselines table
    const { data, error } = await supabase
      .from('design_baselines')
      .insert({
        id: baselineId,
        project_id: projectId,
        name,
        source_type: 'url',
        snapshot_path: snapshotPath,
        baseline_dom_path: baselineDomPath,
        viewport,
        approved: false,
        diff_threshold_pct: diffThresholdPct,
        ignore_regions: ignoreRegions,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }

    // 5. Return baseline data
    const baseline: DesignBaseline = {
      id: data.id,
      projectId: data.project_id,
      name: data.name,
      sourceType: data.source_type,
      snapshotPath: data.snapshot_path,
      viewport: data.viewport,
      approved: data.approved,
      approvedAt: data.approved_at,
      createdAt: data.created_at,
    };

    return jsonResponse({ baselineId: baseline.id, previewUrl }, 201);
  } catch (error: any) {
    console.error('[DESIGN_BASELINE] Create failed:', error);
    return jsonError(error.message || 'Failed to create design baseline', 500);
  }
}

export async function handleApproveBaseline(baselineId: string): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    // Validate UUID format
    if (!baselineId || !baselineId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return jsonError('Invalid baseline ID format', 400);
    }

    // Update baseline to approved
    const { data, error } = await supabase
      .from('design_baselines')
      .update({
        approved: true,
        approved_at: new Date().toISOString(),
      })
      .eq('id', baselineId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return jsonError('Baseline not found', 404);
      }
      throw new Error(`Database update failed: ${error.message}`);
    }

    // Return updated baseline
    const baseline: DesignBaseline = {
      id: data.id,
      projectId: data.project_id,
      name: data.name,
      sourceType: data.source_type,
      snapshotPath: data.snapshot_path,
      viewport: data.viewport,
      approved: data.approved,
      approvedAt: data.approved_at,
      createdAt: data.created_at,
    };

    console.log('[DESIGN_BASELINE] Approved:', baselineId);
    return jsonResponse({ baseline }, 200);
  } catch (error: any) {
    console.error('[DESIGN_BASELINE] Approve failed:', error);
    return jsonError(error.message || 'Failed to approve baseline', 500);
  }
}

// ============================================================================
// Monitor Handlers
// ============================================================================

export async function handleCreateMonitor(req: Request, userId: string): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    const body: CreateMonitorRequest = await req.json();
    const {
      baselineId,
      targetUrl,
      cadence = 'daily',
    } = body;
    const projectId = userId;

    // Validation
    if (!baselineId || !targetUrl) {
      return jsonError('baselineId and targetUrl are required', 400);
    }

    if (!['hourly', 'daily'].includes(cadence)) {
      return jsonError('cadence must be "hourly" or "daily"', 400);
    }

    // SSRF protection
    const urlCheck = isUrlSafe(targetUrl);
    if (!urlCheck.safe) {
      return jsonError(urlCheck.error || 'URL not allowed', 400);
    }

    // 1. Ensure baseline exists and is approved
    const { data: baselineData, error: baselineError } = await supabase
      .from('design_baselines')
      .select('id, approved, snapshot_path, viewport, diff_threshold_pct, ignore_regions')
      .eq('id', baselineId)
      .single();

    if (baselineError || !baselineData) {
      return jsonError('Baseline not found', 404);
    }

    if (!baselineData.approved) {
      return jsonError('Baseline must be approved before creating a monitor', 403);
    }

    // 2. Insert into monitors table.
    // Set last_run_at to now so the cron does not immediately pick this monitor
    // up as "never run" while the first runMonitor() call is still in flight.
    const { data, error } = await supabase
      .from('monitors')
      .insert({
        project_id: projectId,
        baseline_id: baselineId,
        target_url: targetUrl,
        cadence,
        enabled: true,
        last_run_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }

    // 3. Return monitor data
    const monitor: Monitor = {
      id: data.id,
      projectId: data.project_id,
      baselineId: data.baseline_id,
      targetUrl: data.target_url,
      cadence: data.cadence,
      enabled: data.enabled,
      createdAt: data.created_at,
    };

    console.log('[MONITOR] Created:', monitor.id);

    // 4. Execute first comparison via runMonitor (single source of truth for the run pipeline)
    const runResult = await runMonitor(monitor.id);

    return jsonResponse({
      monitorId: monitor.id,
      mismatchPercentage: runResult.mismatchPercentage,
    }, 201);
  } catch (error: any) {
    console.error('[MONITOR] Create failed:', error);
    return jsonError(error.message || 'Failed to create monitor', 500);
  }
}

export async function handleDeleteMonitor(monitorId: string, userId: string): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    // Confirm monitor exists and belongs to this user
    const { data: monitor, error: fetchError } = await supabase
      .from('monitors')
      .select('id, project_id')
      .eq('id', monitorId)
      .eq('project_id', userId)
      .single();

    if (fetchError || !monitor) {
      return jsonError('Monitor not found', 404);
    }

    // Delete all runs for this monitor first (FK safe)
    await supabase.from('visual_runs').delete().eq('monitor_id', monitorId);

    // Delete the monitor
    const { error: deleteError } = await supabase
      .from('monitors')
      .delete()
      .eq('id', monitorId);

    if (deleteError) {
      throw new Error(`Failed to delete monitor: ${deleteError.message}`);
    }

    console.log('[MONITOR] Deleted:', monitorId);
    return new Response(null, { status: 204 });
  } catch (error: any) {
    console.error('[MONITOR] Delete failed:', error);
    return jsonError(error.message || 'Failed to delete monitor', 500);
  }
}

export async function handleListMonitors(req: Request, userId: string): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    const projectId = userId;

    // Fetch all monitors for project
    const { data: monitors, error: monitorsError } = await supabase
      .from('monitors')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (monitorsError) {
      throw new Error(`Database query failed: ${monitorsError.message}`);
    }

    if (!monitors || monitors.length === 0) {
      return jsonResponse([]);
    }

    // For each monitor, fetch baseline name and latest run
    const results = await Promise.all(
      monitors.map(async (monitor) => {
        // Fetch baseline name
        const { data: baseline } = await supabase
          .from('design_baselines')
          .select('name')
          .eq('id', monitor.baseline_id)
          .single();

        // Fetch latest run
        const { data: latestRun } = await supabase
          .from('visual_runs')
          .select('mismatch_percentage, created_at')
          .eq('monitor_id', monitor.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          monitorId: monitor.id,
          baselineName: baseline?.name || 'Unknown',
          latestMismatchPercentage: latestRun?.mismatch_percentage ? parseFloat(latestRun.mismatch_percentage) : null,
          lastRunAt: latestRun?.created_at || null,
          enabled: monitor.enabled,
          targetUrl: monitor.target_url,
        };
      })
    );

    return jsonResponse(results);
  } catch (error: any) {
    console.error('[MONITOR] List failed:', error);
    return jsonError(error.message || 'Failed to list monitors', 500);
  }
}

export async function handleListMonitorRuns(monitorId: string): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    const { data, error } = await supabase
      .from('visual_runs')
      .select('*')
      .eq('monitor_id', monitorId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    const runs = await Promise.all(
      (data || []).map(async (row) => {
        const currentUrl = row.current_path ? await getSignedUrl(row.current_path) : null;
        const diffUrl = row.diff_path ? await getSignedUrl(row.diff_path) : null;

        return {
          id: row.id,
          monitorId: row.monitor_id,
          baselineId: row.baseline_id,
          status: row.status,
          mismatchPercentage: parseFloat(row.mismatch_percentage),
          diffPixels: row.diff_pixels,
          createdAt: row.created_at,
          currentUrl,
          diffUrl,
          aiStatus: row.ai_status,
          aiJson: row.ai_json,
          cssDiffJson: row.css_diff_json || null,
        };
      })
    );

    return jsonResponse(runs);
  } catch (error: any) {
    console.error('[MONITOR] List runs failed:', error);
    return jsonError(error.message || 'Failed to list monitor runs', 500);
  }
}

// ============================================================================
// Run Handlers
// ============================================================================

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
          aiStatus: row.ai_status,
          aiError: row.ai_error,
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

    // Fetch baseline snapshot path from design_baselines
    const { data: baselineData } = await supabase
      .from('design_baselines')
      .select('snapshot_path')
      .eq('id', baselineId)
      .single();

    // Generate signed URLs
    const currentUrl = await getSignedUrl(runData.current_path);
    const diffUrl = runData.diff_path ? await getSignedUrl(runData.diff_path) : null;
    const baselineUrl = baselineData?.snapshot_path
      ? await getSignedUrl(baselineData.snapshot_path)
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
      aiStatus: runData.ai_status,
      aiError: runData.ai_error,
      cssDiffJson: runData.css_diff_json || null,
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

export async function handleGetRunById(runId: string): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    // Fetch run
    const { data: runData, error: runError } = await supabase
      .from('visual_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (runError || !runData) {
      return jsonError('Run not found', 404);
    }

    // Fetch baseline snapshot path from design_baselines
    const { data: baselineData, error: baselineError } = await supabase
      .from('design_baselines')
      .select('snapshot_path')
      .eq('id', runData.baseline_id)
      .single();

    // Generate signed URLs
    const currentUrl = runData.current_path ? await getSignedUrl(runData.current_path) : null;
    const diffUrl = runData.diff_path ? await getSignedUrl(runData.diff_path) : null;
    const baselineUrl = baselineData?.snapshot_path ? await getSignedUrl(baselineData.snapshot_path) : null;

    const response = {
      runId: runData.id,
      mismatchPercentage: parseFloat(runData.mismatch_percentage),
      baselineImageUrl: baselineUrl,
      currentImageUrl: currentUrl,
      diffImageUrl: diffUrl,
      createdAt: runData.created_at,
    };

    return jsonResponse(response);
  } catch (error: any) {
    console.error('[RUN] GetById failed:', error);
    return jsonError(error.message || 'Failed to get run', 500);
  }
}

/**
 * Execute a monitor run: capture screenshot, compare, save results
 * @param monitorId - Monitor ID to execute
 * @returns Run result with runId and mismatch percentage
 */
async function runMonitor(monitorId: string): Promise<{ runId: string; mismatchPercentage: number }> {
  const supabase = getSupabaseServer();

  // Fetch monitor
  const { data: monitor, error: monitorError } = await supabase
    .from('monitors')
    .select('*')
    .eq('id', monitorId)
    .single();

  if (monitorError || !monitor) {
    throw new Error('Monitor not found');
  }

  // Fetch approved baseline
  const { data: baseline, error: baselineError } = await supabase
    .from('design_baselines')
    .select('*')
    .eq('id', monitor.baseline_id)
    .eq('approved', true)
    .single();

  if (baselineError || !baseline) {
    throw new Error('Approved baseline not found');
  }

  // Download baseline snapshot
  const baselineBytes = await downloadFile(baseline.snapshot_path);

  let currentBytes: Uint8Array;
  try {
    console.log('[RUN_MONITOR] Capturing screenshot for monitor:', monitor.id, 'url:', monitor.target_url);
    currentBytes = await captureScreenshot({
      url: monitor.target_url,
      viewport: baseline.viewport,
      captureSettings: {},
    });
  } catch (error: any) {
    console.error('[RUN_MONITOR] Screenshot capture failed:', {
      monitorId: monitor.id,
      targetUrl: monitor.target_url,
      error: error?.message || String(error),
    });
    throw error;
  }

  let diffResult: Awaited<ReturnType<typeof comparePngExact>>;
  try {
    diffResult = await comparePngExact(baselineBytes, currentBytes, {
      ignoreRegions: baseline.ignore_regions || [],
      diffThresholdPct: baseline.diff_threshold_pct ?? 0.2,
    });
  } catch (error: any) {
    console.error('[RUN_MONITOR] Diff calculation failed:', {
      monitorId: monitor.id,
      baselineId: baseline.id,
      error: error?.message || String(error),
    });
    throw error;
  }

  // Generate run ID and storage paths
  const runId = crypto.randomUUID();
  const currentPath = `${monitor.project_id}/monitors/${monitor.id}/runs/${runId}/current.png`;
  const diffPath = diffResult.diffPngBytes
    ? `${monitor.project_id}/monitors/${monitor.id}/runs/${runId}/diff.png`
    : null;
  const resultPath = `${monitor.project_id}/monitors/${monitor.id}/runs/${runId}/result.json`;

  try {
    await uploadFile(currentPath, currentBytes, 'image/png');
    if (diffResult.diffPngBytes && diffPath) {
      await uploadFile(diffPath, diffResult.diffPngBytes, 'image/png');
    }
  } catch (error: any) {
    console.error('[STORAGE_UPLOAD_ERROR]', error);
    console.error('[RUN_MONITOR] Storage upload failed:', {
      monitorId: monitor.id,
      runId,
      currentPath,
      diffPath,
      error: error?.message || String(error),
    });
    throw error;
  }

  // CSS Diff: capture current DOM snapshot and compare against baseline (non-fatal)
  let cssDiffJson: any = null;
  let currentDomPath: string | null = null;
  try {
    const currentDomSnapshot = await captureDomSnapshot({
      url: monitor.target_url,
      viewport: baseline.viewport,
      captureSettings: {},
    });
    if (currentDomSnapshot.length > 0) {
      // Upload current DOM snapshot
      currentDomPath = `${monitor.project_id}/monitors/${monitor.id}/runs/${runId}/current-dom.json`;
      await uploadFile(currentDomPath, new TextEncoder().encode(JSON.stringify(currentDomSnapshot)), 'application/json');

      // Compare against baseline DOM if available
      if (baseline.baseline_dom_path) {
        const baselineDomBytes = await downloadFile(baseline.baseline_dom_path);
        const baselineDomSnapshot: DomSnapshot = JSON.parse(new TextDecoder().decode(baselineDomBytes));
        if (baselineDomSnapshot.length > 0) {
          const diffs = compareDomSnapshots(baselineDomSnapshot, currentDomSnapshot);
          if (diffs.length > 0) cssDiffJson = diffs;
        }
      }
    }
    console.log('[RUN_MONITOR] CSS diff:', cssDiffJson ? `${cssDiffJson.length} elements changed` : 'no changes or no baseline DOM');
  } catch (e: any) {
    console.warn('[RUN_MONITOR] CSS diff pipeline failed (non-fatal):', e.message);
  }

  // Generate signed URLs for AI analysis
  let baselineUrl: string;
  let currentUrl: string;
  let diffUrl: string | null;
  try {
    baselineUrl = await getSignedUrl(baseline.snapshot_path);
    currentUrl = await getSignedUrl(currentPath);
    diffUrl = diffPath ? await getSignedUrl(diffPath) : null;
  } catch (error: any) {
    console.error('[SIGNED_URL_ERROR]', error);
    throw error;
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  // Do not block on AI; start async update after inserting run
  let aiInsights: any = null;
  let aiStatus: 'skipped' | 'completed' | 'failed' = 'skipped';
  let aiError: string | null = null;

  // Upload result JSON
  const resultJson = {
    mismatchPercentage: diffResult.mismatchPercentage,
    diffPixels: diffResult.diffPixels,
    baselineUrl,
    currentUrl,
    diffUrl,
    ai: aiInsights,
  };
  try {
    await uploadFile(resultPath, new TextEncoder().encode(JSON.stringify(resultJson, null, 2)), 'application/json');
  } catch (error: any) {
    console.error('[STORAGE_UPLOAD_ERROR]', error);
    console.error('[RUN_MONITOR] Storage upload failed:', {
      monitorId: monitor.id,
      runId,
      resultPath,
      error: error?.message || String(error),
    });
    throw error;
  }

  let runData: { id: string };
  try {
    const { data, error: runError } = await supabase
      .from('visual_runs')
      .insert({
        id: runId,
        monitor_id: monitor.id,
        baseline_id: monitor.baseline_id,
        project_id: monitor.project_id,
        status: 'completed',
        mismatch_percentage: diffResult.mismatchPercentage,
        diff_pixels: diffResult.diffPixels,
        current_path: currentPath,
        diff_path: diffPath,
        result_path: resultPath,
        current_source_url: monitor.target_url,
        baseline_dom_path: baseline.baseline_dom_path || null,
        current_dom_path: currentDomPath,
        css_diff_json: cssDiffJson,
        ai_json: null,
        ai_status: 'skipped',
        ai_error: null,
      })
      .select('id')
      .single();

    if (runError || !data) {
      throw new Error(`Failed to insert run: ${runError?.message || 'unknown error'}`);
    }
    runData = data;
  } catch (error: any) {
    console.error('[RUN_INSERT_ERROR]', error);
    console.error('[RUN_MONITOR] Database insert failed:', {
      monitorId: monitor.id,
      runId,
      error: error?.message || String(error),
    });
    throw error;
  }

  console.log('[RUN_MONITOR] Monitor run completed:', monitor.id, 'runId:', runId);

  // Kick off AI analysis asynchronously (do not block)
  if (OPENAI_API_KEY) {
    (async () => {
      try {
        const insights = await generateAIInsights({
          baselineUrl,
          currentUrl,
          diffUrl,
          mismatchPercentage: diffResult.mismatchPercentage,
          diffPixels: diffResult.diffPixels,
          baselineSourceUrl: monitor.target_url,
          currentSourceUrl: monitor.target_url,
          duplicationAllowed: false,
        });
        const filtered = {
          ...insights,
          issues: filterAIIssues(insights?.issues, {
            mismatchPercentage: diffResult.mismatchPercentage,
            diffPixels: diffResult.diffPixels,
          }),
        };
        await supabase
          .from('visual_runs')
          .update({ ai_json: filtered, ai_status: 'completed', ai_error: null })
          .eq('id', runId);
      } catch (e: any) {
        await supabase
          .from('visual_runs')
          .update({ ai_json: { error: e?.message ?? String(e) }, ai_status: 'failed', ai_error: e?.message ?? String(e) })
          .eq('id', runId);
        console.warn('[RUN_MONITOR] Async AI analysis failed for run:', runId, e?.message ?? e);
      }
    })();
  }

  // Record when this monitor was last executed so cron can enforce cadence
  await supabase
    .from('monitors')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', monitorId);

  return {
    runId: runData.id,
    mismatchPercentage: diffResult.mismatchPercentage,
  };
}

export async function handleCronTick(): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Select all enabled monitors (fetch candidates, filter by cadence below)
    const { data: allMonitors, error: monitorsError } = await supabase
      .from('monitors')
      .select('*')
      .eq('enabled', true)
      .limit(50);

    if (monitorsError) {
      throw new Error(`Database query failed: ${monitorsError.message}`);
    }

    // 2. Filter to only monitors that are due based on their cadence
    const monitors = (allMonitors || []).filter((m) => {
      if (!m.last_run_at) return true; // Never run — always execute
      if (m.cadence === 'hourly') return m.last_run_at < oneHourAgo;
      if (m.cadence === 'daily') return m.last_run_at < oneDayAgo;
      return false;
    });

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: (allMonitors?.length ?? 0) - monitors.length,
      runs: [] as any[],
    };

    // 3. Process each due monitor
    for (const monitor of monitors) {
      results.processed++;
      
      try {
        console.log('[CRON] Processing monitor:', monitor.id);
        
        const runResult = await runMonitor(monitor.id);
        
        results.succeeded++;
        results.runs.push({
          monitorId: monitor.id,
          runId: runResult.runId,
          status: 'success',
          mismatchPercentage: runResult.mismatchPercentage,
        });
      } catch (e: any) {
        results.failed++;
        results.runs.push({
          monitorId: monitor.id,
          status: 'failed',
          error: e.message,
        });
        console.error('[CRON] Monitor execution failed:', monitor.id, e);
      }
    }

    return jsonResponse(results);
  } catch (error: any) {
    console.error('[CRON] Tick failed:', error);
    return jsonError(error.message || 'Failed to process cron tick', 500);
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
