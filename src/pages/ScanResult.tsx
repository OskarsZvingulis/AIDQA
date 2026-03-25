import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Share2, Copy, FileDown, Twitter, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import DesignPreview from '@/components/DesignPreview'
import { getApiBaseUrl, getAuthHeaders } from '@/lib/apiBase'

type Scan = {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  input_type: 'url' | 'screenshot'
  input_url?: string
  input_filename?: string
  score?: number
  category_scores?: Record<string, number>
  finding_count?: number
  det_status: string
  ai_status: string
  error_message?: string
  created_at: string
}

type Evidence =
  | { type: 'bbox'; x: number; y: number; width: number; height: number; label?: string }
  | { type: 'multi_bbox'; boxes: Array<{ x: number; y: number; width: number; height: number; label?: string }>; description?: string }
  | { type: 'region'; description: string }
  | { type: 'metric'; measured: string; threshold: string; element?: string }
  | { type: 'explanation' }

type Finding = {
  id: string
  category: string
  severity: string
  title: string
  evidence_type: string
  evidence: Evidence
  why_it_matters: string
  repair_guidance: string
  ai_fix_instruction: string
  metric_value?: string
  score_impact?: number
  source: string
}

type Artifacts = {
  normalized_path?: string | null
  overlay_path?: string | null
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'destructive',
  high: 'outline',
  medium: 'secondary',
  low: 'secondary',
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
}


export default function ScanResult() {
  const { scanId } = useParams<{ scanId: string }>()
  const navigate = useNavigate()
  const [scan, setScan] = useState<Scan | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [artifacts, setArtifacts] = useState<Artifacts>({})
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null)
  const [expandedFix, setExpandedFix] = useState<string | null>(null)
  const [showOverlay, setShowOverlay] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!scanId || !UUID_RE.test(scanId)) { navigate('/'); return }

    const fetchScan = async () => {
      const headers = await getAuthHeaders()
      const res = await fetch(`${getApiBaseUrl()}/v1/scans/${scanId}`, { headers })
      if (res.status === 401) {
        if (pollRef.current) clearInterval(pollRef.current)
        navigate('/login')
        return
      }
      if (!res.ok) return
      const data: Scan = await res.json()
      setScan(data)

      if (data.status === 'completed' || data.status === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)

        if (data.status === 'completed') {
          const [findingsRes, artifactsRes] = await Promise.all([
            fetch(`${getApiBaseUrl()}/v1/scans/${scanId}/findings`, { headers }),
            fetch(`${getApiBaseUrl()}/v1/scans/${scanId}/artifacts`, { headers }),
          ])
          if (findingsRes.ok) {
            const fd = await findingsRes.json()
            setFindings(fd.findings ?? [])
          }
          if (artifactsRes.ok) {
            const ad = await artifactsRes.json()
            setArtifacts(ad)
          }
        }
      }
    }

    fetchScan()
    pollRef.current = setInterval(fetchScan, 1500)
    timeoutRef.current = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current)
      setScan(prev => prev?.status === 'pending' || prev?.status === 'processing'
        ? { ...prev, status: 'failed', error_message: 'Scan timed out. Please try again.' }
        : prev
      )
    }, 120000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [scanId, navigate])

  const [showPreview, setShowPreview] = useState(false)

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    toast.success('Link copied to clipboard')
  }

  const handleShareX = () => {
    const score = scan?.score ?? 0
    const text = encodeURIComponent(`Just ran a design QA scan — scored ${score}/100 with ${findings.length} issue${findings.length !== 1 ? 's' : ''} found.`)
    const url = encodeURIComponent(window.location.href)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
  }

  const isLoading = !scan || scan.status === 'pending' || scan.status === 'processing'
  const imageUrl = showOverlay ? artifacts.overlay_path : artifacts.normalized_path

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-semibold truncate max-w-lg">
                {scan?.input_url ?? scan?.input_filename ?? 'Scan'}
              </h1>
              {scan?.input_type && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {scan.input_type === 'url' ? 'URL' : 'Screenshot'}
                </Badge>
              )}
            </div>
            {scan?.created_at && (
              <p className="text-xs text-muted-foreground">
                {new Date(scan.created_at).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 no-print">
            {scan?.status === 'completed' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Share2 className="w-4 h-4 mr-1" /> Share
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => window.print()}>
                    <FileDown className="w-4 h-4 mr-2" /> Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <Copy className="w-4 h-4 mr-2" /> Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShareX}>
                    <Twitter className="w-4 h-4 mr-2" /> Share on X
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
              History
            </Button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">
              {scan?.status === 'processing' ? 'Analysing…' : 'Starting scan…'}
            </p>
          </div>
        )}

        {/* Error state */}
        {scan?.status === 'failed' && (
          <div className="py-12 text-center">
            <p className="text-destructive font-medium mb-1">Scan failed</p>
            <p className="text-sm text-muted-foreground">{scan.error_message}</p>
            <Button className="mt-4" onClick={() => navigate('/')}>Try again</Button>
          </div>
        )}

        {/* Results */}
        {scan?.status === 'completed' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

            {/* Left: image viewer */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  className={`text-xs px-2 py-1 rounded ${showOverlay ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  onClick={() => setShowOverlay(true)}
                >Overlay</button>
                <button
                  className={`text-xs px-2 py-1 rounded ${!showOverlay ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  onClick={() => setShowOverlay(false)}
                >Original</button>
              </div>
              <div className="relative border rounded-lg overflow-hidden bg-muted">
                {imageUrl ? (
                  <>
                    <img
                      src={imageUrl}
                      alt="UI screenshot"
                      className="w-full h-auto block"
                    />
                  </>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                    No image available
                  </div>
                )}
              </div>
            </div>

            {/* Right: score + findings */}
            <div className="space-y-4">
              {/* Score bar */}
              {scan.score != null && (
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Overall score</span>
                      <span className={`text-xl font-bold ${scan.score >= 80 ? 'text-green-600' : scan.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {scan.score}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${scan.score >= 80 ? 'bg-green-500' : scan.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${scan.score}%` }}
                      />
                    </div>
                    {scan.category_scores && (
                      <div className="mt-3 grid grid-cols-3 gap-1">
                        {Object.entries(scan.category_scores).map(([cat, s]) => (
                          <div key={cat} className="text-center">
                            <div className="text-xs text-muted-foreground capitalize">{cat.replace('_', ' ')}</div>
                            <div className="text-xs font-medium">{s}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Preview fixed design — above findings */}
              {findings.length > 0 && (
                <Button
                  className="w-full no-print"
                  onClick={() => setShowPreview(true)}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Preview fixed design
                </Button>
              )}

              {/* Findings */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {findings.length} finding{findings.length !== 1 ? 's' : ''}
                </h2>
                {findings.length === 0 && (
                  <Card>
                    <CardContent className="py-6 text-center text-sm text-muted-foreground">
                      No issues found — looks clean!
                    </CardContent>
                  </Card>
                )}
                {findings.map(f => (
                  <Card
                    key={f.id}
                    className={`cursor-pointer transition-all ${selectedFinding === f.id ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => setSelectedFinding(f.id === selectedFinding ? null : f.id)}
                  >
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-start gap-2">
                        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[f.severity]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <Badge variant={SEVERITY_COLORS[f.severity] as 'destructive' | 'outline' | 'secondary'} className="text-xs">
                              {f.severity}
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">{f.category.replace('_', ' ')}</Badge>
                            <Badge variant="outline" className="text-xs">{f.source}</Badge>
                          </div>
                          <CardTitle className="text-sm font-semibold leading-snug">{f.title}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 space-y-2">
                      {/* Evidence callout */}
                      {f.evidence_type === 'metric' && (
                        <div className="bg-muted rounded p-2 text-xs space-y-0.5">
                          <div><span className="font-medium">Measured:</span> {(f.evidence as { measured: string }).measured}</div>
                          <div><span className="font-medium">Required:</span> {(f.evidence as { threshold: string }).threshold}</div>
                          {(f.evidence as { element?: string }).element && (
                            <div className="text-muted-foreground">{(f.evidence as { element: string }).element}</div>
                          )}
                        </div>
                      )}
                      {f.evidence_type === 'region' && (
                        <div className="bg-muted rounded px-2 py-1 text-xs text-muted-foreground">
                          Area: {(f.evidence as { description: string }).description}
                        </div>
                      )}
                      {f.evidence_type === 'multi_bbox' && (f.evidence as { description?: string }).description && (
                        <div className="bg-muted rounded px-2 py-1 text-xs text-muted-foreground">
                          {(f.evidence as { description: string }).description}
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">{f.why_it_matters}</p>
                      <p className="text-xs">{f.repair_guidance}</p>

                      {/* AI fix instruction */}
                      <div>
                        <button
                          className="text-xs text-primary underline-offset-2 hover:underline"
                          onClick={e => { e.stopPropagation(); setExpandedFix(expandedFix === f.id ? null : f.id) }}
                        >
                          {expandedFix === f.id ? 'Hide' : 'Show'} AI fix instruction
                        </button>
                        {expandedFix === f.id && (
                          <pre className="mt-2 text-xs bg-muted p-2 rounded whitespace-pre-wrap font-mono">
                            {f.ai_fix_instruction}
                          </pre>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

            </div>
          </div>
        )}
      </main>

      {scanId && (
        <DesignPreview
          open={showPreview}
          onClose={() => setShowPreview(false)}
          scanId={scanId}
          findings={findings}
          beforeImageUrl={artifacts.normalized_path}
        />
      )}
    </div>
  )
}
