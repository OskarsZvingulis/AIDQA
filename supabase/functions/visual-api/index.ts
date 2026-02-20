// Supabase Edge Function: Visual Regression API
import { corsHeaders } from './_lib/cors.ts';
import { AuthError, getUserFromRequest } from './_lib/supabaseServer.ts';
import {
  handleListBaselines,
  handleListRuns,
  handleGetRun,
  handleGetRunById,
  handleCronTick,
  handleCreateDesignBaseline,
  handleApproveBaseline,
  handleCreateMonitor,
  handleDeleteMonitor,
  handleListMonitors,
  handleListMonitorRuns,
} from './visual/handlers.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // ----------------------------------------------------------------
    // Health — no auth required
    // ----------------------------------------------------------------
    if (path.includes('/health')) {
      return respond(
        new Response(
          JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }

    // ----------------------------------------------------------------
    // Cron — authenticated by service role key (not a user JWT)
    // api/cron-tick.ts sends `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    // ----------------------------------------------------------------
    if (path.includes('/cron/tick')) {
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const provided = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
      if (!serviceKey || provided !== serviceKey) {
        return respond(
          new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
        );
      }
      const response = req.method === 'POST'
        ? await handleCronTick()
        : new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
      return respond(response);
    }

    // ----------------------------------------------------------------
    // All other routes — validate user JWT first
    // ----------------------------------------------------------------
    let userId: string;
    try {
      userId = await getUserFromRequest(req);
    } catch (e) {
      if (e instanceof AuthError) {
        return respond(
          new Response(JSON.stringify({ error: e.message }), { status: 401, headers: { 'Content-Type': 'application/json' } })
        );
      }
      throw e;
    }

    // ----------------------------------------------------------------
    // Route dispatch (user routes)
    // ----------------------------------------------------------------
    let response: Response;

    if (path.match(/\/baselines\/[\w-]+\/approve$/)) {
      const [, baselineId] = path.match(/\/baselines\/([\w-]+)\/approve$/)!;
      response = req.method === 'POST'
        ? await handleApproveBaseline(baselineId)
        : new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

    } else if (path.includes('/baselines') && !path.match(/runs/)) {
      response = req.method === 'GET'
        ? await handleListBaselines(req, userId)
        : await handleCreateDesignBaseline(req, userId);

    } else if (path.match(/\/baselines\/[\w-]+\/runs\/[\w-]+$/)) {
      const [, baselineId, runId] = path.match(/\/baselines\/([\w-]+)\/runs\/([\w-]+)$/)!;
      response = await handleGetRun(baselineId, runId);

    } else if (path.match(/\/baselines\/[\w-]+\/runs$/)) {
      const [, baselineId] = path.match(/\/baselines\/([\w-]+)\/runs$/)!;
      response = req.method === 'GET'
        ? await handleListRuns(baselineId)
        : new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

    } else if (path.match(/\/runs\/[\w-]+$/)) {
      const [, runId] = path.match(/\/runs\/([\w-]+)$/)!;
      response = req.method === 'GET'
        ? await handleGetRunById(runId)
        : new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

    } else if (path.match(/\/monitors\/[\w-]+\/runs$/)) {
      const [, monitorId] = path.match(/\/monitors\/([\w-]+)\/runs$/)!;
      response = req.method === 'GET'
        ? await handleListMonitorRuns(monitorId)
        : new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

    } else if (path.match(/\/monitors\/[\w-]+$/)) {
      const [, monitorId] = path.match(/\/monitors\/([\w-]+)$/)!;
      response = req.method === 'DELETE'
        ? await handleDeleteMonitor(monitorId, userId)
        : new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

    } else if (path.includes('/monitors') && !path.match(/\/monitors\/[\w-]+/)) {
      if (req.method === 'POST') {
        response = await handleCreateMonitor(req, userId);
      } else if (req.method === 'GET') {
        response = await handleListMonitors(req, userId);
      } else {
        response = new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
      }

    } else {
      return respond(
        new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
      );
    }

    return respond(response);
  } catch (error: any) {
    console.error('[API] Error:', error);
    return respond(
      new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }
});

/** Attach CORS headers to any response. */
function respond(res: Response): Response {
  const headers = new Headers(res.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  return new Response(res.body, { status: res.status, headers });
}
