import { CORS_HEADERS, corsError } from './_lib/cors.ts'
import {
  handleCreateScan,
  handleListScans,
  handleGetScan,
  handleGetFindings,
  handleGetArtifacts,
  handleDeleteScan,
} from './scan/handlers.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/aidqa-api/, '')

  // ── Health check ─────────────────────────────────────────────────────────────
  if (path === '/health' && req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // ── Scan routes ──────────────────────────────────────────────────────────────

  // POST /v1/scans
  if (path === '/v1/scans' && req.method === 'POST') {
    return handleCreateScan(req)
  }

  // GET /v1/scans
  if (path === '/v1/scans' && req.method === 'GET') {
    return handleListScans(req)
  }

  // GET /v1/scans/:id/findings
  const findingsMatch = path.match(/^\/v1\/scans\/([^/]+)\/findings$/)
  if (findingsMatch && req.method === 'GET') {
    return handleGetFindings(req, findingsMatch[1])
  }

  // GET /v1/scans/:id/artifacts
  const artifactsMatch = path.match(/^\/v1\/scans\/([^/]+)\/artifacts$/)
  if (artifactsMatch && req.method === 'GET') {
    return handleGetArtifacts(req, artifactsMatch[1])
  }

  // GET | DELETE /v1/scans/:id
  const scanMatch = path.match(/^\/v1\/scans\/([^/]+)$/)
  if (scanMatch && req.method === 'GET') {
    return handleGetScan(req, scanMatch[1])
  }
  if (scanMatch && req.method === 'DELETE') {
    return handleDeleteScan(req, scanMatch[1])
  }

  return corsError('Not found', 404)
})
