// Supabase Edge Function: Visual Regression API
// Main router with CORS handling

import {
  handleCreateBaseline,
  handleListBaselines,
  handleCreateRun,
  handleListRuns,
  handleGetRun,
} from './visual/handlers.ts';

// CORS configuration
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map(o => o.trim());

function getCorsHeaders(origin: string | null): HeadersInit {
  const allowOrigin = origin && (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin))
    ? origin
    : ALLOWED_ORIGINS[0] || '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// Main handler
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // Health check
    if (path === '/health' || path === '/visual-api/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route matching
    let response: Response;

    if (path === '/api/v1/visual/baselines' || path === '/visual-api/api/v1/visual/baselines') {
      if (req.method === 'GET') {
        response = await handleListBaselines(req);
      } else if (req.method === 'POST') {
        response = await handleCreateBaseline(req);
      } else {
        response = new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else if (path.match(/^\/(?:visual-api\/)?api\/v1\/visual\/baselines\/([^\/]+)\/runs$/)) {
      const match = path.match(/^\/(?:visual-api\/)?api\/v1\/visual\/baselines\/([^\/]+)\/runs$/);
      const baselineId = match![1];

      if (req.method === 'GET') {
        response = await handleListRuns(baselineId);
      } else if (req.method === 'POST') {
        response = await handleCreateRun(baselineId);
      } else {
        response = new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else if (path.match(/^\/(?:visual-api\/)?api\/v1\/visual\/baselines\/([^\/]+)\/runs\/([^\/]+)$/)) {
      const match = path.match(/^\/(?:visual-api\/)?api\/v1\/visual\/baselines\/([^\/]+)\/runs\/([^\/]+)$/);
      const baselineId = match![1];
      const runId = match![2];

      if (req.method === 'GET') {
        response = await handleGetRun(baselineId, runId);
      } else {
        response = new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      response = new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add CORS headers to response
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error: any) {
    console.error('[API] Unhandled error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
