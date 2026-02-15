// Visual Regression API route handlers

import { getSupabaseServer } from '../_lib/supabaseServer.ts';
import { uploadFile, getSignedUrl, downloadFile } from '../_lib/storage.ts';
import { isUrlSafe } from '../_lib/ssrfGuard.ts';
import type {
  Baseline,
  Run,
  CreateBaselineRequest,
  CreateRunRequest,
  DesignBaseline,
  CreateDesignBaselineRequest,
  Monitor,
  CreateMonitorRequest,
  APIError,
} from '../_lib/types.ts';
import { captureScreenshot } from './capture.ts';
import { comparePngExact } from './diff.ts';
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

export async function handleCreateBaseline(req: Request): Promise<Response> {
  const body: CreateBaselineRequest = await req.json();
  const { 
    projectId, 
    name, 
    url, 
    source,
    viewport = { width: 1440, height: 900 },
    diffThresholdPct = 0.2,
    ignoreRegions = [],
    captureSettings = {}
  } = body;

  if (!projectId || !name) {
    return jsonError('projectId and name are required', 400);
  }

  // Determine source: new source object or legacy URL
  let sourceType: 'url' | 'storybook' | 'figma_frame';
  let sourceConfig: Record<string, any>;
  
  if (source) {
    // New source mode
    sourceType = source.type;
    sourceConfig = source.config;
  } else if (url) {
    // Legacy URL mode (backward compat)
    sourceType = 'url';
    sourceConfig = { url };
  } else {
    return jsonError('Either url or source is required', 400);
  }

  // Extract capture URL based on source type
  let captureUrl: string;
  if (sourceType === 'url') {
    captureUrl = sourceConfig.url;
    if (!captureUrl) {
      return jsonError('URL source requires config.url', 400);
    }
  } else {
    return jsonError(`Source type '${sourceType}' not yet implemented`, 501);
  }

  // SSRF protection
  const urlCheck = isUrlSafe(captureUrl);
  if (!urlCheck.safe) {
    return jsonError(urlCheck.error || 'URL not allowed', 400);
  }

  const supabase = getSupabaseServer();

  try {
    // 1. Create baseline source
    const { data: sourceData, error: sourceError } = await supabase
      .from('baseline_sources')
      .insert({
        project_id: projectId,
        type: sourceType,
        name,
        config: sourceConfig,
        viewport,
      })
      .select()
      .single();

    if (sourceError) {
      throw new Error(`Failed to create source: ${sourceError.message}`);
    }

    const sourceId = sourceData.id;

    // 2. Capture baseline screenshot
    console.log('[BASELINE] Capturing screenshot for:', captureUrl);
    const screenshotBytes = await captureScreenshot({ 
      url: captureUrl, 
      viewport,
      captureSettings 
    });

    // 3. Generate baseline ID and storage path
    const baselineId = crypto.randomUUID();
    const baselinePath = `${projectId}/baselines/${baselineId}/baseline.png`;

    // 4. Upload to Supabase Storage
    await uploadFile(baselinePath, screenshotBytes, 'image/png');

    // 5. Insert baseline into database
    const { data, error } = await supabase
      .from('visual_baselines')
      .insert({
        id: baselineId,
        project_id: projectId,
        name,
        url: captureUrl, // Keep for backward compat
        viewport,
        baseline_path: baselinePath,
        diff_threshold_pct: diffThresholdPct,
        ignore_regions: ignoreRegions,
        capture_settings: captureSettings,
        source_id: sourceId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }

    // 6. Generate signed URL for response
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
      diffThresholdPct: data.diff_threshold_pct,
      ignoreRegions: data.ignore_regions,
      captureSettings: data.capture_settings,
      sourceId: data.source_id,
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
    // Join with baseline_sources to get source metadata
    const { data, error } = await supabase
      .from('visual_baselines')
      .select(`
        *,
        baseline_sources (
          id,
          type,
          name,
          config,
          viewport,
          created_at
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Generate signed URLs for all baselines
    const baselines: Baseline[] = await Promise.all(
      (data || []).map(async (row) => {
        const sourceData = row.baseline_sources;
        return {
          id: row.id,
          projectId: row.project_id,
          name: row.name,
          url: row.url,
          viewport: row.viewport,
          createdAt: row.created_at,
          baselinePath: row.baseline_path,
          baselineUrl: await getSignedUrl(row.baseline_path),
          diffThresholdPct: row.diff_threshold_pct,
          ignoreRegions: row.ignore_regions,
          captureSettings: row.capture_settings,
          sourceId: row.source_id,
          source: sourceData ? {
            id: sourceData.id,
            projectId: row.project_id,
            type: sourceData.type,
            name: sourceData.name,
            config: sourceData.config,
            viewport: sourceData.viewport,
            createdAt: sourceData.created_at,
          } : undefined,
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

export async function handleCreateDesignBaseline(req: Request): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    const body = await req.json();
    const {
      projectId = 'default',
      name,
      sourceUrl,
      viewport = { width: 1440, height: 900 },
    } = body;

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

    // 4. Insert into design_baselines table
    const { data, error } = await supabase
      .from('design_baselines')
      .insert({
        id: baselineId,
        project_id: projectId,
        name,
        source_type: 'url',
        snapshot_path: snapshotPath,
        viewport,
        approved: false,
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

    return jsonResponse({ baselineId: baseline.id, snapshotPath: baseline.snapshotPath }, 201);
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

export async function handleCreateMonitor(req: Request): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    const body: CreateMonitorRequest = await req.json();
    const {
      projectId,
      baselineId,
      targetUrl,
      cadence = 'daily',
    } = body;

    // Validation
    if (!projectId || !baselineId || !targetUrl) {
      return jsonError('projectId, baselineId, and targetUrl are required', 400);
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
      .select('id, approved')
      .eq('id', baselineId)
      .single();

    if (baselineError || !baselineData) {
      return jsonError('Baseline not found', 404);
    }

    if (!baselineData.approved) {
      return jsonError('Baseline must be approved before creating a monitor', 403);
    }

    // 2. Insert into monitors table
    const { data, error } = await supabase
      .from('monitors')
      .insert({
        project_id: projectId,
        baseline_id: baselineId,
        target_url: targetUrl,
        cadence,
        enabled: true,
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
    return jsonResponse({ monitorId: monitor.id, monitor }, 201);
  } catch (error: any) {
    console.error('[MONITOR] Create failed:', error);
    return jsonError(error.message || 'Failed to create monitor', 500);
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
      captureSettings: baseline.capture_settings || {},
    });

    // Download baseline screenshot
    console.log('[RUN] Downloading baseline from storage');
    const baselineBytes = await downloadFile(baseline.baseline_path);

    // Compare and generate diff with ignore regions and threshold
    console.log('[RUN] Computing pixel diff');
    const diffResult = await comparePngExact(baselineBytes, currentBytes, {
      ignoreRegions: baseline.ignore_regions || [],
      diffThresholdPct: baseline.diff_threshold_pct,
    });

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

    // Check if AI is available
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    let aiInsights: any = null;
    let aiStatus: 'skipped' | 'completed' | 'failed' = 'skipped';
    let aiError: string | null = null;

    if (!OPENAI_API_KEY) {
      console.log('[RUN] OpenAI API key not configured, skipping AI analysis');
      aiStatus = 'skipped';
    } else {
      // Generate AI insights (optional - will not fail the run)
      console.log('[RUN] Generating AI insights');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
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
        aiInsights = {
          ...aiInsights,
          issues: filterAIIssues(aiInsights?.issues, {
            mismatchPercentage: diffResult.mismatchPercentage,
            diffPixels: diffResult.diffPixels,
          }),
        };
        aiStatus = 'completed';
        console.log('[RUN] AI analysis completed successfully');
      } catch (e: any) {
        const errorMsg = e?.message ?? String(e);
        const errorStack = e?.stack ?? '';
        console.error('[RUN] AI analysis failed (non-fatal):', errorMsg);
        aiStatus = 'failed';
        aiError = `${errorMsg}${errorStack ? '\n' + errorStack : ''}`;
        aiInsights = { error: errorMsg };
      } finally {
        clearTimeout(timeout);
      }
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

    // Insert run into database (always succeeds for visual diff)
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
        ai_status: aiStatus,
        ai_error: aiError,
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
      aiStatus: runData.ai_status,
      aiError: runData.ai_error,
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
      aiStatus: runData.ai_status,
      aiError: runData.ai_error,
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
// Job Handlers
// ============================================================================

export async function handleCreateJob(req: Request): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    const body = await req.json();
    const { projectId, baselineId, cadence } = body;

    if (!projectId || !baselineId || !cadence) {
      return jsonError('projectId, baselineId, and cadence are required', 400);
    }

    // Calculate next run time based on cadence
    const nextRunAt = calculateNextRun(cadence);

    const { data, error } = await supabase
      .from('visual_jobs')
      .insert({
        project_id: projectId,
        baseline_id: baselineId,
        cadence,
        next_run_at: nextRunAt,
        enabled: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`);
    }

    const job = {
      id: data.id,
      projectId: data.project_id,
      baselineId: data.baseline_id,
      cadence: data.cadence,
      nextRunAt: data.next_run_at,
      enabled: data.enabled,
      createdAt: data.created_at,
    };

    return jsonResponse(job, 201);
  } catch (error: any) {
    console.error('[JOB] Create failed:', error);
    return jsonError(error.message || 'Failed to create job', 500);
  }
}

export async function handleRunJob(jobId: string): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    // Fetch job
    const { data: jobData, error: jobError } = await supabase
      .from('visual_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !jobData) {
      return jsonError('Job not found', 404);
    }

    if (!jobData.enabled) {
      return jsonError('Job is disabled', 400);
    }

    // Fetch baseline
    const { data: baselineData, error: baselineError } = await supabase
      .from('visual_baselines')
      .select('*')
      .eq('id', jobData.baseline_id)
      .single();

    if (baselineError || !baselineData) {
      return jsonError('Baseline not found for job', 404);
    }

    const baseline = baselineData;

    // Use baseline URL for the run
    if (!baseline.url) {
      return jsonError('Baseline has no URL to capture', 400);
    }

    // Capture current screenshot
    console.log('[JOB] Capturing screenshot for job:', jobId);
    const currentBytes = await captureScreenshot({
      url: baseline.url,
      viewport: baseline.viewport,
      captureSettings: baseline.capture_settings || {},
    });

    // Download baseline screenshot
    const baselineBytes = await downloadFile(baseline.baseline_path);

    // Compare and generate diff
    const diffResult = await comparePngExact(baselineBytes, currentBytes, {
      ignoreRegions: baseline.ignore_regions || [],
      diffThresholdPct: baseline.diff_threshold_pct,
    });

    // Generate run ID and storage paths
    const runId = crypto.randomUUID();
    const currentPath = `${baseline.project_id}/baselines/${baseline.id}/runs/${runId}/current.png`;
    const diffPath = diffResult.diffPngBytes
      ? `${baseline.project_id}/baselines/${baseline.id}/runs/${runId}/diff.png`
      : null;
    const resultPath = `${baseline.project_id}/baselines/${baseline.id}/runs/${runId}/result.json`;

    // Upload screenshots
    await uploadFile(currentPath, currentBytes, 'image/png');
    if (diffResult.diffPngBytes && diffPath) {
      await uploadFile(diffPath, diffResult.diffPngBytes, 'image/png');
    }

    // Generate signed URLs
    const baselineUrl = await getSignedUrl(baseline.baseline_path);
    const currentUrl = await getSignedUrl(currentPath);
    const diffUrl = diffPath ? await getSignedUrl(diffPath) : null;

    // Try AI analysis (optional)
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    let aiInsights: any = null;
    let aiStatus: 'skipped' | 'completed' | 'failed' = 'skipped';
    let aiError: string | null = null;

    if (OPENAI_API_KEY) {
      try {
        aiInsights = await generateAIInsights({
          baselineUrl,
          currentUrl,
          diffUrl,
          mismatchPercentage: diffResult.mismatchPercentage,
          diffPixels: diffResult.diffPixels,
          baselineSourceUrl: baseline.url,
          currentSourceUrl: baseline.url,
          duplicationAllowed: false,
        });
        aiInsights = {
          ...aiInsights,
          issues: filterAIIssues(aiInsights?.issues, {
            mismatchPercentage: diffResult.mismatchPercentage,
            diffPixels: diffResult.diffPixels,
          }),
        };
        aiStatus = 'completed';
      } catch (e: any) {
        aiStatus = 'failed';
        aiError = e?.message ?? String(e);
        aiInsights = { error: aiError };
        console.error('[JOB] AI analysis failed:', aiError);
      }
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
    await uploadFile(resultPath, new TextEncoder().encode(JSON.stringify(resultJson, null, 2)), 'application/json');

    // Insert run into database
    const { data: runData, error: runError } = await supabase
      .from('visual_runs')
      .insert({
        id: runId,
        baseline_id: baseline.id,
        project_id: baseline.project_id,
        status: 'completed',
        mismatch_percentage: diffResult.mismatchPercentage,
        diff_pixels: diffResult.diffPixels,
        current_path: currentPath,
        diff_path: diffPath,
        result_path: resultPath,
        current_source_url: baseline.url,
        ai_json: aiInsights,
        ai_status: aiStatus,
        ai_error: aiError,
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Database insert failed: ${runError.message}`);
    }

    // Update job's next_run_at
    const nextRunAt = calculateNextRun(jobData.cadence);
    await supabase
      .from('visual_jobs')
      .update({ next_run_at: nextRunAt })
      .eq('id', jobId);

    return jsonResponse({
      runId: runData.id,
      status: runData.status,
      mismatchPercentage: diffResult.mismatchPercentage,
      diffPixels: diffResult.diffPixels,
      aiStatus,
    }, 201);
  } catch (error: any) {
    console.error('[JOB] Run failed:', error);
    return jsonError(error.message || 'Failed to run job', 500);
  }
}

export async function handleCronTick(): Promise<Response> {
  const supabase = getSupabaseServer();

  try {
    // 1. Select all enabled monitors
    const { data: monitors, error: monitorsError } = await supabase
      .from('monitors')
      .select('*')
      .eq('enabled', true)
      .limit(50); // Process max 50 monitors per tick

    if (monitorsError) {
      throw new Error(`Database query failed: ${monitorsError.message}`);
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      runs: [] as any[],
    };

    // 2. Process each monitor
    for (const monitor of monitors || []) {
      results.processed++;
      
      try {
        console.log('[CRON] Processing monitor:', monitor.id);

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

        // Capture current screenshot from target_url
        console.log('[CRON] Capturing screenshot for monitor:', monitor.id, 'url:', monitor.target_url);
        const currentBytes = await captureScreenshot({
          url: monitor.target_url,
          viewport: baseline.viewport,
          captureSettings: {},
        });

        // Run pixel diff
        const diffResult = await comparePngExact(baselineBytes, currentBytes, {
          ignoreRegions: [],
          diffThresholdPct: 0.2,
        });

        // Generate run ID and storage paths
        const runId = crypto.randomUUID();
        const currentPath = `${monitor.project_id}/monitors/${monitor.id}/runs/${runId}/current.png`;
        const diffPath = diffResult.diffPngBytes
          ? `${monitor.project_id}/monitors/${monitor.id}/runs/${runId}/diff.png`
          : null;
        const resultPath = `${monitor.project_id}/monitors/${monitor.id}/runs/${runId}/result.json`;

        // Upload screenshots
        await uploadFile(currentPath, currentBytes, 'image/png');
        if (diffResult.diffPngBytes && diffPath) {
          await uploadFile(diffPath, diffResult.diffPngBytes, 'image/png');
        }

        // Generate signed URLs for AI analysis
        const baselineUrl = await getSignedUrl(baseline.snapshot_path);
        const currentUrl = await getSignedUrl(currentPath);
        const diffUrl = diffPath ? await getSignedUrl(diffPath) : null;

        // AI analysis (optional, async, non-blocking)
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        let aiInsights: any = null;
        let aiStatus: 'skipped' | 'completed' | 'failed' = 'skipped';
        let aiError: string | null = null;

        if (OPENAI_API_KEY) {
          try {
            aiInsights = await generateAIInsights({
              baselineUrl,
              currentUrl,
              diffUrl,
              mismatchPercentage: diffResult.mismatchPercentage,
              diffPixels: diffResult.diffPixels,
              baselineSourceUrl: monitor.target_url,
              currentSourceUrl: monitor.target_url,
              duplicationAllowed: false,
            });
            aiInsights = {
              ...aiInsights,
              issues: filterAIIssues(aiInsights?.issues, {
                mismatchPercentage: diffResult.mismatchPercentage,
                diffPixels: diffResult.diffPixels,
              }),
            };
            aiStatus = 'completed';
          } catch (e: any) {
            aiStatus = 'failed';
            aiError = e?.message ?? String(e);
            aiInsights = { error: aiError };
            console.warn('[CRON] AI analysis failed for monitor:', monitor.id, aiError);
          }
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
        await uploadFile(resultPath, new TextEncoder().encode(JSON.stringify(resultJson, null, 2)), 'application/json');

        // Insert run into visual_runs table
        const { data: runData, error: runError } = await supabase
          .from('visual_runs')
          .insert({
            id: runId,
            baseline_id: monitor.baseline_id,
            project_id: monitor.project_id,
            status: 'completed',
            mismatch_percentage: diffResult.mismatchPercentage,
            diff_pixels: diffResult.diffPixels,
            current_path: currentPath,
            diff_path: diffPath,
            result_path: resultPath,
            current_source_url: monitor.target_url,
            ai_json: aiInsights,
            ai_status: aiStatus,
            ai_error: aiError,
          })
          .select()
          .single();

        if (runError) {
          throw new Error(`Failed to insert run: ${runError.message}`);
        }

        results.succeeded++;
        results.runs.push({
          monitorId: monitor.id,
          runId: runData.id,
          status: 'success',
          mismatchPercentage: diffResult.mismatchPercentage,
          aiStatus,
        });

        console.log('[CRON] Monitor run completed:', monitor.id, 'runId:', runId);
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

function calculateNextRun(cadence: string): string {
  const now = new Date();
  
  if (cadence === 'hourly') {
    now.setHours(now.getHours() + 1);
  } else if (cadence === 'daily') {
    now.setDate(now.getDate() + 1);
  } else if (cadence === 'weekly') {
    now.setDate(now.getDate() + 7);
  } else {
    // Default to daily if unknown cadence
    now.setDate(now.getDate() + 1);
  }
  
  return now.toISOString();
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
