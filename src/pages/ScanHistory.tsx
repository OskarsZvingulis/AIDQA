import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getApiBaseUrl, getAuthHeaders } from '@/lib/apiBase'

type Scan = {
  id: string
  status: string
  input_type: string
  input_url?: string
  input_filename?: string
  score?: number
  finding_count?: number
  created_at: string
}

const scoreColor = (s: number) =>
  s >= 80 ? 'text-green-600' : s >= 60 ? 'text-yellow-600' : 'text-red-600'

export default function ScanHistory() {
  const navigate = useNavigate()
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const LIMIT = 20

  useEffect(() => {
    const fetchScans = async () => {
      setLoading(true)
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(`${getApiBaseUrl()}/v1/scans?page=${page}&limit=${LIMIT}`, { headers })
        if (!res.ok) return
        const data = await res.json()
        setScans(data.scans ?? [])
        setTotal(data.total ?? 0)
      } finally {
        setLoading(false)
      }
    }
    fetchScans()
  }, [page])

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Scan history</h1>
          <Button onClick={() => navigate('/')}>New scan</Button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && scans.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="mb-3">No scans yet.</p>
            <Button variant="outline" onClick={() => navigate('/')}>Start your first scan</Button>
          </div>
        )}

        {!loading && scans.length > 0 && (
          <>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">URL / File</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Score</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Findings</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {scans.map(scan => (
                    <tr
                      key={scan.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/scans/${scan.id}`)}
                    >
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs shrink-0">
                            {scan.input_type === 'url' ? 'URL' : 'File'}
                          </Badge>
                          <span className="truncate text-sm">
                            {scan.input_url ?? scan.input_filename ?? scan.id}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {scan.score != null ? (
                          <span className={`font-semibold ${scoreColor(scan.score)}`}>{scan.score}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {scan.finding_count ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={scan.status === 'completed' ? 'secondary' : scan.status === 'failed' ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {scan.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(scan.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > LIMIT && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
