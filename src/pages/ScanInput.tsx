import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import { Input } from '@/components/ui/input'
import { getApiBaseUrl, getAuthHeaders } from '@/lib/apiBase'

function Spinner() {
  return (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

export default function ScanInput() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'url' | 'screenshot'>('url')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usage, setUsage] = useState<{ scans_this_month: number; limit: number; plan: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)

  useEffect(() => {
    getAuthHeaders().then(headers => {
      return fetch(`${getApiBaseUrl()}/v1/usage`, { headers })
        .then(async r => {
          if (!r.ok) return null
          try { return await r.json() } catch { return null }
        })
        .then(d => { if (d) setUsage(d) })
        .catch(() => {})
    }).catch(() => {})
  }, [])

  const isValidUrl = (s: string) => {
    try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:' } catch { return false }
  }

  const handleUrlScan = async () => {
    if (submitting.current) return
    let trimmed = url.trim()
    if (trimmed && !/^https?:\/\//i.test(trimmed)) trimmed = 'https://' + trimmed
    if (!trimmed || !isValidUrl(trimmed)) { setError('Enter a valid URL (e.g. example.com)'); return }
    if (trimmed.length > 2048) { setError('URL too long'); return }
    setError(null)
    submitting.current = true
    setLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${getApiBaseUrl()}/v1/scans`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'url', url: trimmed }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (res.status === 401) { navigate('/login'); return }
      if (!res.ok) throw new Error(data.error ?? data.message ?? `Request failed (${res.status})`)
      navigate(`/scans/${data.scan_id}`)
    } catch (e) {
      setError(e instanceof Error && e.name === 'AbortError' ? 'Request timed out. Try again.' : String(e))
    } finally {
      clearTimeout(timeout)
      setLoading(false)
      submitting.current = false
    }
  }

  const handleFileScan = async () => {
    if (submitting.current) return
    if (!file) { setError('Select a file first'); return }
    setError(null)
    submitting.current = true
    setLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const headers = await getAuthHeaders()
      delete (headers as Record<string, string>)['Content-Type']
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${getApiBaseUrl()}/v1/scans`, {
        method: 'POST',
        headers,
        body: form,
        signal: controller.signal,
      })
      const data = await res.json()
      if (res.status === 401) { navigate('/login'); return }
      if (!res.ok) throw new Error(data.error ?? data.message ?? `Request failed (${res.status})`)
      navigate(`/scans/${data.scan_id}`)
    } catch (e) {
      setError(e instanceof Error && e.name === 'AbortError' ? 'Request timed out. Try again.' : String(e))
    } finally {
      clearTimeout(timeout)
      setLoading(false)
      submitting.current = false
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped && /\.(png|jpe?g|webp)$/i.test(dropped.name)) {
      setFile(dropped)
      setError(null)
    } else {
      setError('Only PNG, JPG, or WEBP files are accepted')
    }
  }

  const isAdmin = usage?.plan === 'admin'
  const atLimit = usage && !isAdmin && usage.scans_this_month >= usage.limit
  const scansLeft = usage && !isAdmin ? Math.max(0, usage.limit - usage.scans_this_month) : null
  const progressPct = usage && !isAdmin ? Math.min(100, (usage.scans_this_month / usage.limit) * 100) : 0
  const btnDisabled = loading || !!atLimit

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[hsl(222_20%_8%)]">
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 py-12 space-y-5">

        {/* ── Two-column header: headline left, usage card right ── */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-start">

          {/* Headline */}
          <div>
            <span
              className="inline-flex items-center text-xs font-semibold rounded-full px-3 py-1"
              style={{ backgroundColor: '#FF8B00', color: '#FFFFFF' }}
            >
              Design QA
            </span>
            <h1 className="text-3xl font-bold mt-3 mb-2 leading-tight" style={{ color: '#172B4D' }}>
              Scan a page for design issues
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: '#5A6679' }}>
              Get a prioritized QA report from a live URL or screenshot. Catch layout, hierarchy, consistency, UX, and accessibility issues in minutes.
            </p>
          </div>

          {/* Usage stats card */}
          {usage && (
            <div className="bg-white rounded-2xl p-4 space-y-3 shrink-0 w-56" style={{ border: '1px solid #DFE1E6' }}>
              {isAdmin ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: '#172B4D' }}>Unlimited scans</span>
                    <span className="text-base">∞</span>
                  </div>
                  <p className="text-xs" style={{ color: '#5A6679' }}>Admin — no limits applied</p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: atLimit ? '#C9372C' : '#172B4D' }}>
                      {atLimit ? 'No scans left' : `${scansLeft} scan${scansLeft === 1 ? '' : 's'} left`}
                    </span>
                    <span className="text-xs font-medium" style={{ color: '#FF8B00' }}>This month</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: '#DFE1E6' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progressPct}%`, backgroundColor: atLimit ? '#C9372C' : '#172B4D' }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold" style={{ color: '#172B4D' }}>Starter</p>
                      <p className="text-xs" style={{ color: '#5A6679' }}>{usage.limit} scans / month</p>
                    </div>
                    <a
                      href="https://lp.aidesignqa.com#pricing"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg shrink-0 transition-colors"
                      style={{ border: '1px solid #DFE1E6', color: '#172B4D', backgroundColor: '#FFFFFF' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = '#2563EB'
                        ;(e.currentTarget as HTMLElement).style.color = '#2563EB'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = '#DFE1E6'
                        ;(e.currentTarget as HTMLElement).style.color = '#172B4D'
                      }}
                    >
                      Upgrade — €19/mo
                    </a>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Main card ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #DFE1E6' }}>

          {/* Tab switcher */}
          <div className="p-3">
            <div className="flex rounded-xl p-1" style={{ backgroundColor: '#F4F5F7' }}>
              {(['url', 'screenshot'] as const).map(tab => (
                <button
                  key={tab}
                  className="flex-1 py-2 text-sm rounded-lg transition-all"
                  style={activeTab === tab ? {
                    backgroundColor: '#FFFFFF',
                    color: '#172B4D',
                    fontWeight: 600,
                    border: '1px solid #DFE1E6',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  } : {
                    color: '#172B4D',
                    background: 'transparent',
                    border: '1px solid transparent',
                  }}
                  onClick={() => { setActiveTab(tab); setError(null) }}
                >
                  {tab === 'url' ? 'Scan URL' : 'Upload screenshot'}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="px-5 pb-2">
            {activeTab === 'url' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium block" style={{ color: '#172B4D' }}>Page URL</label>
                <Input
                  className="h-11 text-sm placeholder:text-[#595959] placeholder:opacity-100"
                  placeholder="https://your-page.com"
                  value={url}
                  onChange={e => { setUrl(e.target.value); if (error) setError(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleUrlScan()}
                  disabled={loading || !!atLimit}
                />
                <p className="text-xs pt-0.5" style={{ color: '#5A6679' }}>
                  Use a public URL. Private or staged pages can be supported later via authenticated scans.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
                  style={{ borderColor: '#DFE1E6' }}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#2563EB'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#DFE1E6'}
                >
                  {file ? (
                    <p className="text-sm font-medium" style={{ color: '#172B4D' }}>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    </p>
                  ) : (
                    <>
                      <p className="text-sm mb-1" style={{ color: '#5A6679' }}>Drop a file or click to browse</p>
                      <p className="text-xs" style={{ color: '#5A6679' }}>PNG, JPG, WEBP — max 10 MB</p>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setError(null) } }}
                  />
                </div>
                <p className="text-xs px-3 py-2 rounded-lg" style={{ color: '#5A6679', backgroundColor: '#F4F5F7' }}>
                  Screenshot scans provide layout and hierarchy analysis only. For precise contrast, spacing, and accessibility checks, scan a live URL.
                </p>
              </div>
            )}

            {error && (
              <p className="mt-3 text-xs font-medium" style={{ color: '#C9372C' }}>{error}</p>
            )}
          </div>

          {/* Feature grid — inside card, above action bar */}
          <div className="grid grid-cols-3 gap-2 px-5 py-4">
            {[
              { label: 'Covers', value: 'Layout, UX, accessibility, hierarchy, consistency' },
              { label: 'Input', value: 'Live URL or screenshot' },
              { label: 'Output', value: 'Prioritized findings with fix guidance' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl p-3" style={{ border: '1px solid #DFE1E6' }}>
                <p className="text-xs uppercase tracking-wide font-medium mb-1" style={{ color: '#5A6679' }}>{label}</p>
                <p className="text-sm font-medium leading-relaxed" style={{ color: '#172B4D' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Action bar */}
          <div className="px-5 py-4 flex items-center justify-between gap-4" style={{ borderTop: '1px solid #DFE1E6' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#172B4D' }}>Ready to scan</p>
              <p className="text-xs mt-0.5" style={{ color: '#5A6679' }}>Most reports are generated in under a minute.</p>
            </div>
            <button
              disabled={btnDisabled}
              onClick={activeTab === 'url' ? handleUrlScan : handleFileScan}
              className="shrink-0 rounded-[6px] transition-colors flex items-center"
              style={{
                padding: '12px 24px',
                fontWeight: 600,
                fontSize: '1rem',
                border: 'none',
                cursor: btnDisabled ? 'not-allowed' : 'pointer',
                backgroundColor: atLimit ? '#F3F4F6' : '#2563EB',
                color: atLimit ? '#6B7280' : '#FFFFFF',
              }}
              onMouseEnter={e => {
                if (!btnDisabled && !atLimit) (e.currentTarget as HTMLElement).style.backgroundColor = '#1D4ED8'
              }}
              onMouseLeave={e => {
                if (!btnDisabled && !atLimit) (e.currentTarget as HTMLElement).style.backgroundColor = '#2563EB'
              }}
            >
              {loading && <Spinner />}
              {loading ? 'Scanning…' : 'Scan Page'}
            </button>
          </div>
        </div>

      </main>
    </div>
  )
}
