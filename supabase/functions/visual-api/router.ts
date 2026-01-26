// API Router - Handle all visual regression endpoints
// Routes match the existing Express API for compatibility

import {
  createBaseline,
  createRun,
  getBaseline,
  getRun,
  listBaselines,
  listRuns,
  createArtifact,
  getArtifactsForRun,
  getBaselineArtifact,
} from "./services/database.ts";
import { uploadImage, downloadImage } from "./services/storage.ts";
import { captureScreenshot } from "./services/serverlessBrowser.ts";
import { compareImages, DimensionMismatchError } from "./services/imageDiff.ts";

interface RouteHandler {
  (req: Request, params: Record<string, string>): Promise<Response>;
}

const routes: Array<{
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}> = [];

function route(
  method: string,
  path: string,
  handler: RouteHandler
) {
  const paramNames: string[] = [];
  const pattern = new RegExp(
    "^" +
      path
        .replace(/:\w+/g, (match) => {
          paramNames.push(match.slice(1));
          return "([^/]+)";
        })
        .replace(/\//g, "\\/") +
      "$"
  );

  routes.push({ method, pattern, paramNames, handler });
}

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname.replace(/^\/visual-api/, ""); // Remove function prefix

  console.log(`[${req.method}] ${pathname}`);

  // Find matching route
  for (const { method, pattern, paramNames, handler } of routes) {
    if (req.method === method) {
      const match = pathname.match(pattern);
      if (match) {
        const params: Record<string, string> = {};
        paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
        return await handler(req, params);
      }
    }
  }

  return jsonResponse({ error: "Not found" }, 404);
}

// Utility: JSON response
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ============================================================================
// Route Handlers
// ============================================================================

// GET /health
route("GET", "/health", async () => {
  return jsonResponse({
    ok: true,
    service: "visual-api",
    timestamp: new Date().toISOString(),
  });
});

// POST /api/v1/visual/baselines
route("POST", "/api/v1/visual/baselines", async (req) => {
  try {
    const body = await req.json();
    const { project_id, name, url, figmaSource, viewport } = body;

    if (!project_id || !name) {
      return jsonResponse(
        { error: "project_id and name are required" },
        400
      );
    }

    if (!url && !figmaSource) {
      return jsonResponse(
        { error: "Either url or figmaSource must be provided" },
        400
      );
    }

    const viewportData = viewport || { width: 1440, height: 900 };

    // Create baseline record
    const baseline = await createBaseline({
      project_id,
      name,
      source_url: url,
      figma_file_key: figmaSource?.figmaFileKey,
      figma_node_ids: figmaSource?.figmaNodeIds,
      viewport_json: viewportData,
    });

    // Capture screenshot
    let htmlContent: string | undefined;
    if (figmaSource) {
      // TODO: Implement Figma content fetching if needed
      // For now, throw error if Figma is requested
      throw new Error("Figma integration not yet implemented in Edge Function");
    }

    const screenshot = await captureScreenshot({
      url,
      htmlContent,
      viewport: viewportData,
    });

    // Upload to storage
    const uploadResult = await uploadImage(
      project_id,
      baseline.id,
      "baseline.png",
      screenshot
    );

    // Create artifact record
    await createArtifact({
      baseline_id: baseline.id,
      type: "baseline",
      storage_path: uploadResult.path,
      storage_bucket: "visual",
    });

    return jsonResponse(
      {
        baselineId: baseline.id,
        projectId: baseline.project_id,
        name: baseline.name,
        url: baseline.source_url,
        viewport: baseline.viewport_json,
        baselineImagePath: uploadResult.publicUrl,
        createdAt: baseline.created_at,
      },
      201
    );
  } catch (error) {
    console.error("[ERROR] Create baseline failed:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to create baseline",
      },
      500
    );
  }
});

// GET /api/v1/visual/baselines
route("GET", "/api/v1/visual/baselines", async (req) => {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return jsonResponse({ error: "projectId is required" }, 400);
  }

  const baselines = await listBaselines(projectId);
  return jsonResponse(baselines);
});

// GET /api/v1/visual/baselines/:baselineId
route("GET", "/api/v1/visual/baselines/:baselineId", async (req, params) => {
  const baseline = await getBaseline(params.baselineId);

  if (!baseline) {
    return jsonResponse({ error: "Baseline not found" }, 404);
  }

  return jsonResponse(baseline);
});

// POST /api/v1/visual/baselines/:baselineId/runs
route("POST", "/api/v1/visual/baselines/:baselineId/runs", async (req, params) => {
  try {
    const baseline = await getBaseline(params.baselineId);
    if (!baseline) {
      return jsonResponse({ error: "Baseline not found" }, 404);
    }

    const body = await req.json();
    const viewport = body.viewport || baseline.viewport_json;
    const url = body.url || baseline.source_url;

    // Capture current screenshot
    const currentScreenshot = await captureScreenshot({
      url,
      viewport,
    });

    // Get baseline image
    const baselineArtifact = await getBaselineArtifact(baseline.id);
    if (!baselineArtifact) {
      throw new Error("Baseline image not found");
    }

    const baselineImage = await downloadImage(baselineArtifact.storage_path);

    // Compare images
    let runData: {
      status: "PASS" | "FAIL" | "ERROR";
      error_code?: string;
      mismatch_pixel_count: number;
      total_pixels: number;
      mismatch_percent: number;
    };

    let diffImage: Uint8Array | null = null;

    try {
      const diffResult = await compareImages(baselineImage, currentScreenshot);
      
      runData = {
        status: diffResult.pass ? "PASS" : "FAIL",
        mismatch_pixel_count: diffResult.mismatchPixelCount,
        total_pixels: diffResult.totalPixels,
        mismatch_percent: diffResult.mismatchPercent,
      };

      diffImage = diffResult.diffImage;
    } catch (error) {
      if (error instanceof DimensionMismatchError) {
        runData = {
          status: "ERROR",
          error_code: "DIMENSION_MISMATCH",
          mismatch_pixel_count: 0,
          total_pixels: 0,
          mismatch_percent: 0,
        };
      } else {
        throw error;
      }
    }

    // Create run record
    const run = await createRun({
      baseline_id: baseline.id,
      viewport_json: viewport,
      ...runData,
    });

    // Upload current and diff images
    const currentUpload = await uploadImage(
      baseline.project_id,
      baseline.id,
      `run-${run.id}-current.png`,
      currentScreenshot
    );

    await createArtifact({
      run_id: run.id,
      type: "current",
      storage_path: currentUpload.path,
      storage_bucket: "visual",
    });

    let diffUrl: string | null = null;
    if (diffImage) {
      const diffUpload = await uploadImage(
        baseline.project_id,
        baseline.id,
        `run-${run.id}-diff.png`,
        diffImage
      );

      await createArtifact({
        run_id: run.id,
        type: "diff",
        storage_path: diffUpload.path,
        storage_bucket: "visual",
      });

      diffUrl = diffUpload.publicUrl;
    }

    // Get baseline artifact for response
    const baselineUrl = await downloadImage(baselineArtifact.storage_path);

    return jsonResponse(
      {
        runId: run.id,
        baselineId: run.baseline_id,
        status: run.status,
        errorCode: run.error_code,
        metrics: {
          mismatchPixelCount: run.mismatch_pixel_count,
          totalPixels: run.total_pixels,
          mismatchPercent: run.mismatch_percent,
        },
        artifacts: {
          baseline: baselineArtifact.storage_path,
          current: currentUpload.publicUrl,
          diff: diffUrl,
        },
        createdAt: run.created_at,
      },
      201
    );
  } catch (error) {
    console.error("[ERROR] Create run failed:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to create run",
      },
      500
    );
  }
});

// GET /api/v1/visual/baselines/:baselineId/runs
route("GET", "/api/v1/visual/baselines/:baselineId/runs", async (req, params) => {
  const baseline = await getBaseline(params.baselineId);
  if (!baseline) {
    return jsonResponse({ error: "Baseline not found" }, 404);
  }

  const runs = await listRuns(params.baselineId);
  return jsonResponse(runs);
});

// GET /api/v1/visual/baselines/:baselineId/runs/:runId
route("GET", "/api/v1/visual/baselines/:baselineId/runs/:runId", async (req, params) => {
  const run = await getRun(params.runId);
  if (!run) {
    return jsonResponse({ error: "Run not found" }, 404);
  }

  const artifacts = await getArtifactsForRun(params.runId);

  return jsonResponse({
    ...run,
    artifacts,
  });
});
