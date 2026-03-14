import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getApiBaseUrl, getAuthHeaders } from '@/lib/apiBase'

export default function ScanInput() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isValidUrl = (s: string) => {
    try { new URL(s); return true } catch { return false }
  }

  const handleUrlScan = async () => {
    if (!isValidUrl(url)) { setError('Enter a valid URL including https://'); return }
    setError(null)
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${getApiBaseUrl()}/v1/scans`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'url', url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scan failed')
      navigate(`/scans/${data.scan_id}`)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleFileScan = async () => {
    if (!file) { setError('Select a file first'); return }
    setError(null)
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      delete (headers as Record<string, string>)['Content-Type'] // let browser set multipart boundary
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${getApiBaseUrl()}/v1/scans`, {
        method: 'POST',
        headers,
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scan failed')
      navigate(`/scans/${data.scan_id}`)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
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

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-xl mx-auto px-4 py-16">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Scan a UI</h1>
          <p className="text-muted-foreground text-sm">
            Submit a URL or screenshot to get a prioritized design QA report.
          </p>
        </div>

        <Tabs defaultValue="url">
          <TabsList className="mb-6 w-full">
            <TabsTrigger value="url" className="flex-1">Scan URL</TabsTrigger>
            <TabsTrigger value="screenshot" className="flex-1">Upload screenshot</TabsTrigger>
          </TabsList>

          <TabsContent value="url">
            <div className="space-y-3">
              <Input
                placeholder="https://your-app.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUrlScan()}
                disabled={loading}
              />
              <Button className="w-full" onClick={handleUrlScan} disabled={loading || !url}>
                {loading ? 'Scanning…' : 'Scan'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="screenshot">
            <div className="space-y-3">
              <div
                className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-primary transition-colors"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <p className="text-sm font-medium">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-1">Drop a file or click to browse</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — max 10 MB</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) { setFile(f); setError(null) }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded">
                Screenshot scans provide layout and hierarchy analysis only. For precise contrast, spacing, and accessibility checks, scan a live URL.
              </p>
              <Button className="w-full" onClick={handleFileScan} disabled={loading || !file}>
                {loading ? 'Scanning…' : 'Scan screenshot'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}
      </main>
    </div>
  )
}
