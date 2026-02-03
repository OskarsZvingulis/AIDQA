// Supabase Edge Function: Visual Regression API
import { corsHeaders } from './_lib/cors.ts';
import {
  handleCreateBaseline,
  handleListBaselines,
  handleCreateRun,
  handleListRuns,
  handleGetRun,
} from './visual/handlers.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path.includes('/health')) {
      return new Response(
        JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let response: Response;

    if (path.includes('/baselines') && !path.match(/runs/)) {
      response = req.method === 'GET' ? await handleListBaselines(req) : await handleCreateBaseline(req);
    } else if (path.match(/\/baselines\/[\w-]+\/runs\/[\w-]+$/)) {
      const [, baselineId, runId] = path.match(/\/baselines\/([\w-]+)\/runs\/([\w-]+)$/)!;
      response = await handleGetRun(baselineId, runId);
    } else if (path.match(/\/baselines\/[\w-]+\/runs$/)) {
      const [, baselineId] = path.match(/\/baselines\/([\w-]+)\/runs$/)!;
      response = req.method === 'POST' ? await handleCreateRun(req, baselineId) : await handleListRuns(baselineId);
    } else {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
    return new Response(response.body, { status: response.status, headers });
  } catch (error: any) {
    console.error('[API] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
