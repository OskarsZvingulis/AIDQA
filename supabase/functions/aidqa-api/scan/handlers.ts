import { supabase, getUserFromRequest, getUserInfoFromRequest, AuthError, ADMIN_EMAILS } from '../_lib/supabaseServer.ts'
import { corsResponse, corsError } from '../_lib/cors.ts'
import { isUrlSafe } from '../_lib/ssrfGuard.ts'
import { uploadFile, getSignedUrl } from '../_lib/storage.ts'
import { callGeminiVision, callGeminiRepairGuidance, callGeminiDesignPreview } from '../_lib/gemini.ts'
import { captureScreenshot, captureDomSnapshot } from './capture.ts'
import { normalizeImage, generateOverlay } from './normalize.ts'
import { runAllChecks } from './deterministic.ts'
import { calculateScore, mergeAndPrioritize } from './score.ts'
import type { Finding } from '../_lib/types.ts'

// ─── POST /v1/scans ────────────────────────────────────────────────────────────

export async function handleCreateScan(req: Request): Promise<Response> {
  let userId: string
  let userEmail: string | undefined
  try {
    const info = await getUserInfoFromRequest(req)
    userId = info.id
    userEmail = info.email
  } catch (e) {
    return corsError(e instanceof AuthError ? 'Unauthorized' : String(e), 401)
  }

  const contentType = req.headers.get('content-type') ?? ''
  let inputType: 'url' | 'screenshot'
  let inputUrl: string | null = null
  let inputFilename: string | null = null
  let fileBuffer: Uint8Array | null = null

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return corsError('No file provided', 400)
    if (file.size > 10 * 1024 * 1024) return corsError('File too large (max 10MB)', 400)
    if (file.size < 1024) return corsError('File too small to be a valid image', 400)
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
    if (!ALLOWED_TYPES.includes(file.type)) return corsError('Invalid file type. Upload PNG, JPG or WEBP.', 400)
    inputType = 'screenshot'
    inputFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
    fileBuffer = new Uint8Array(await file.arrayBuffer())
  } else {
    const body = await req.json()
    if (!body.url) return corsError('url is required', 400)
    if (!isUrlSafe(body.url)) return corsError('URL is not allowed', 400)
    inputType = 'url'
    inputUrl = body.url
  }

  // Rate limit: 7 completed scans per calendar month on free plan (admin accounts exempt)
  if (!ADMIN_EMAILS.has(userEmail ?? '')) {
    const rlMonthStart = new Date()
    rlMonthStart.setDate(1)
    rlMonthStart.setHours(0, 0, 0, 0)
    const { count: scanCount } = await supabase.from('scans')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', rlMonthStart.toISOString())
    if ((scanCount ?? 0) >= 7) return corsError('Rate limit: max 7 scans per month on free plan', 429)
  }

  // Insert scan row immediately, return scan_id
  const { data: scan, error: insertError } = await supabase
    .from('scans')
    .insert({
      user_id: userId,
      input_type: inputType,
      input_url: inputUrl,
      input_filename: inputFilename,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !scan) {
    console.error('[createScan] DB insert failed:', insertError?.message)
    return corsError('Failed to create scan', 500)
  }

  const scanId = scan.id

  // Fire background processing
  EdgeRuntime.waitUntil(processScan(scanId, userId, { inputType, inputUrl, fileBuffer, inputFilename }))

  return corsResponse({ scan_id: scanId }, 202)
}

// ─── Background processor ─────────────────────────────────────────────────────

async function processScan(
  scanId: string,
  userId: string,
  input: { inputType: 'url' | 'screenshot'; inputUrl: string | null; fileBuffer: Uint8Array | null; inputFilename: string | null }
): Promise<void> {
  try {
    await supabase.from('scans').update({ status: 'processing' }).eq('id', scanId)

    const basePath = `${userId}/scans/${scanId}`
    let normalizedBytes: Uint8Array
    let domElements = null
    let domPath: string | null = null

    // ── Phase 1: Capture ──────────────────────────────────────────────────────
    if (input.inputType === 'url' && input.inputUrl) {
      const originalBytes = await captureScreenshot(input.inputUrl)
      normalizedBytes = await normalizeImage(originalBytes)

      await uploadFile(`${basePath}/original.png`, originalBytes, 'image/png')
      await uploadFile(`${basePath}/normalized.png`, normalizedBytes, 'image/png')

      // DOM snapshot (non-blocking — failure is acceptable)
      try {
        domElements = await captureDomSnapshot(input.inputUrl)
        const domJson = new TextEncoder().encode(JSON.stringify(domElements))
        domPath = `${basePath}/dom-snapshot.json`
        await uploadFile(domPath, domJson, 'application/json')
      } catch (domErr) {
        console.error(`[${scanId}] DOM snapshot failed:`, domErr)
      }

      await supabase.from('scans').update({
        original_path: `${basePath}/original.png`,
        normalized_path: `${basePath}/normalized.png`,
        dom_path: domPath,
      }).eq('id', scanId)

    } else if (input.fileBuffer) {
      normalizedBytes = await normalizeImage(input.fileBuffer)
      const ext = input.inputFilename?.split('.').pop() ?? 'png'
      await uploadFile(`${basePath}/original.${ext}`, input.fileBuffer, `image/${ext}`)
      await uploadFile(`${basePath}/normalized.png`, normalizedBytes, 'image/png')

      await supabase.from('scans').update({
        original_path: `${basePath}/original.${ext}`,
        normalized_path: `${basePath}/normalized.png`,
      }).eq('id', scanId)
    } else {
      throw new Error('No valid input')
    }

    // ── Phase 2: Deterministic checks ─────────────────────────────────────────
    let deterministicFindings: Finding[] = []

    if (domElements && domElements.length > 0) {
      deterministicFindings = runAllChecks(domElements)
      await supabase.from('scans').update({ det_status: 'completed' }).eq('id', scanId)
    } else {
      await supabase.from('scans').update({ det_status: 'skipped' }).eq('id', scanId)
    }

    // ── Phase 3: Claude Vision ─────────────────────────────────────────────────
    let aiFindings: Finding[] = []

    try {
      const normalizedUrl = await getSignedUrl(`${basePath}/normalized.png`, 3600)
      aiFindings = await callGeminiVision(normalizedUrl, deterministicFindings)
      await supabase.from('scans').update({ ai_status: 'completed' }).eq('id', scanId)
    } catch (aiErr) {
      console.error(`[${scanId}] Gemini Vision failed:`, aiErr)
      await supabase.from('scans').update({
        ai_status: 'failed',
        ai_error: String(aiErr),
      }).eq('id', scanId)
    }

    // ── Phase 4: Merge, repair guidance, score, overlay ───────────────────────
    const merged = mergeAndPrioritize(deterministicFindings, aiFindings)

    // Second Claude pass: improve repair guidance on deterministic findings
    let finalFindings = merged
    if (deterministicFindings.length > 0) {
      try {
        const detOnly = merged.filter(f => f.source === 'deterministic')
        if (detOnly.length > 0) {
          const improved = await callGeminiRepairGuidance(detOnly)
          const improvedMap = new Map(improved.map(f => [f.title, f]))
          finalFindings = merged.map(f => f.source === 'deterministic' ? (improvedMap.get(f.title) ?? f) : f)
        }
      } catch {
        // Non-blocking — keep original guidance
      }
    }

    const { overall, categoryScores } = calculateScore(finalFindings)

    const overlayBytes = await generateOverlay(normalizedBytes, finalFindings)
    await uploadFile(`${basePath}/overlay.png`, overlayBytes, 'image/png')

    // Insert findings rows
    if (finalFindings.length > 0) {
      await supabase.from('findings').insert(
        finalFindings.map(f => ({
          scan_id: scanId,
          user_id: userId,
          category: f.category,
          severity: f.severity,
          title: f.title,
          evidence_type: f.evidence_type,
          evidence: f.evidence,
          why_it_matters: f.why_it_matters,
          repair_guidance: f.repair_guidance,
          ai_fix_instruction: f.ai_fix_instruction,
          metric_value: f.metric_value ?? null,
          score_impact: f.score_impact ?? null,
          source: f.source,
        }))
      )
    }

    await supabase.from('scans').update({
      status: 'completed',
      score: overall,
      category_scores: categoryScores,
      finding_count: finalFindings.length,
      overlay_path: `${basePath}/overlay.png`,
      completed_at: new Date().toISOString(),
    }).eq('id', scanId)

  } catch (err) {
    console.error(`[${scanId}] processScan failed:`, err)
    await supabase.from('scans').update({
      status: 'failed',
      error_message: 'Scan processing failed',
    }).eq('id', scanId)
  }
}

// ─── GET /v1/scans ─────────────────────────────────────────────────────────────

export async function handleListScans(req: Request): Promise<Response> {
  let userId: string
  try { userId = await getUserFromRequest(req) } catch (e) { return corsError(String(e), 401) }

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20') || 20))
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('scans')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return corsError(error.message, 500)

  return corsResponse({ scans: data, total: count ?? 0, page, limit })
}

// ─── GET /v1/scans/:id ─────────────────────────────────────────────────────────

export async function handleGetScan(req: Request, scanId: string): Promise<Response> {
  let userId: string
  try { userId = await getUserFromRequest(req) } catch (e) { return corsError(String(e), 401) }

  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('id', scanId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return corsError('Scan not found', 404)

  return corsResponse(data)
}

// ─── GET /v1/scans/:id/findings ────────────────────────────────────────────────

export async function handleGetFindings(req: Request, scanId: string): Promise<Response> {
  let userId: string
  try { userId = await getUserFromRequest(req) } catch (e) { return corsError(String(e), 401) }

  const { data, error } = await supabase
    .from('findings')
    .select('*')
    .eq('scan_id', scanId)
    .eq('user_id', userId)
    .order('score_impact', { ascending: true })

  if (error) return corsError(error.message, 500)

  return corsResponse({ findings: data ?? [] })
}

// ─── GET /v1/scans/:id/artifacts ───────────────────────────────────────────────

export async function handleGetArtifacts(req: Request, scanId: string): Promise<Response> {
  let userId: string
  try { userId = await getUserFromRequest(req) } catch (e) { return corsError(String(e), 401) }

  const { data: scan, error } = await supabase
    .from('scans')
    .select('normalized_path, overlay_path, dom_path, original_path')
    .eq('id', scanId)
    .eq('user_id', userId)
    .single()

  if (error || !scan) return corsError('Scan not found', 404)

  const artifacts: Record<string, string | null> = {}

  for (const [key, path] of Object.entries(scan)) {
    if (path) {
      try {
        artifacts[key] = await getSignedUrl(path as string)
      } catch {
        artifacts[key] = null
      }
    } else {
      artifacts[key] = null
    }
  }

  return corsResponse(artifacts)
}

// ─── POST /v1/scans/:id/preview ───────────────────────────────────────────────

export async function handlePreviewScan(req: Request, scanId: string): Promise<Response> {
  let userId: string
  try { userId = await getUserFromRequest(req) } catch (e) { return corsError(String(e), 401) }

  const body = await req.json()
  const choices = body.choices
  if (!choices?.step1 || !choices?.step2 || !choices?.step3) {
    return corsError('choices.step1, step2, step3 are required', 400)
  }

  // Whitelist choices to prevent prompt injection
  const VALID_CHOICES = { step1: ['minimal', 'bold'], step2: ['contrast', 'refresh'], step3: ['accessibility', 'layout'] }
  for (const [k, v] of Object.entries(choices)) {
    if (!VALID_CHOICES[k as keyof typeof VALID_CHOICES]?.includes(v as string)) {
      return corsError(`Invalid value for ${k}`, 400)
    }
  }

  const { data: scan, error: scanErr } = await supabase
    .from('scans')
    .select('normalized_path')
    .eq('id', scanId)
    .eq('user_id', userId)
    .single()

  if (scanErr || !scan?.normalized_path) return corsError('Scan not found', 404)

  const { data: findingsData } = await supabase
    .from('findings')
    .select('severity, title, repair_guidance')
    .eq('scan_id', scanId)
    .eq('user_id', userId)
    .order('score_impact', { ascending: true })
    .limit(7)

  const findings = findingsData ?? []

  try {
    const imageUrl = await getSignedUrl(scan.normalized_path, 3600)
    const { description, fix_prompt, preview_image_bytes } = await callGeminiDesignPreview(imageUrl, findings, choices)

    let preview_image_url: string | null = null
    if (preview_image_bytes) {
      const previewPath = `${userId}/scans/${scanId}/preview.png`
      await uploadFile(previewPath, preview_image_bytes, 'image/png')
      preview_image_url = await getSignedUrl(previewPath, 3600)
    }

    console.log(`[PREVIEW] ${scanId} completed — image: ${!!preview_image_bytes}`)
    return corsResponse({ description, fix_prompt, preview_image_url })
  } catch (err) {
    console.error(`[PREVIEW] ${scanId} failed:`, err)
    return corsError('Preview generation failed', 500)
  }
}

// ─── GET /v1/usage ─────────────────────────────────────────────────────────────

export async function handleGetUsage(req: Request): Promise<Response> {
  let userId: string
  let userEmail: string | undefined
  try {
    const info = await getUserInfoFromRequest(req)
    userId = info.id
    userEmail = info.email
  } catch (e) { return corsError(String(e), 401) }

  if (ADMIN_EMAILS.has(userEmail ?? '')) {
    return corsResponse({ scans_this_month: 0, limit: 999, plan: 'admin' })
  }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count } = await supabase.from('scans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('created_at', monthStart.toISOString())

  return corsResponse({ scans_this_month: count ?? 0, limit: 7, plan: 'free' })
}

// ─── DELETE /v1/scans/:id ──────────────────────────────────────────────────────

export async function handleDeleteScan(req: Request, scanId: string): Promise<Response> {
  let userId: string
  try { userId = await getUserFromRequest(req) } catch (e) { return corsError(String(e), 401) }

  const { error } = await supabase
    .from('scans')
    .delete()
    .eq('id', scanId)
    .eq('user_id', userId)

  if (error) return corsError(error.message, 500)

  return corsResponse({ success: true })
}
