import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getApiBaseUrl, getApiHeaders } from '@/lib/apiBase';

type RunResponse = {
  runId: string;
  mismatchPercentage: number;
  severity: 'minor' | 'warning' | 'critical' | string;
  baselineImageUrl?: string | null;
  currentImageUrl?: string | null;
  diffImageUrl?: string | null;
  createdAt: string;
};

export default function RunDetail() {
  const { runId } = useParams();
  const [data, setData] = useState<RunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiBase = getApiBaseUrl();

  useEffect(() => {
    if (!runId) return;
    setError(null);
    setData(null);

    fetch(`${apiBase}/runs/${runId}`, { headers: getApiHeaders() })
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text();
          throw new Error(text || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((json) => setData(json as RunResponse))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load run'));
  }, [runId]);

  const severityBadge = (severity: string) => {
    if (severity === 'critical') return <Badge variant="destructive">CRITICAL</Badge>;
    if (severity === 'warning') return <Badge variant="default" style={{ background: '#facc15' }}>WARNING</Badge>;
    return <Badge variant="default" style={{ background: '#10b981' }}>MINOR</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Run Detail</h1>
          <p className="text-muted-foreground">Run: <span className="font-mono">{runId}</span></p>
        </header>

        {error && (
          <Card className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {data && (
          <>
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {severityBadge(data.severity)}
                  <span className="text-sm text-muted-foreground">{new Date(data.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Mismatch %</p>
                  <p className="text-2xl font-bold">{data.mismatchPercentage.toFixed(4)}%</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded overflow-hidden">
                  <p className="p-2 text-sm font-medium">Baseline</p>
                  {data.baselineImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.baselineImageUrl} alt="Baseline" className="w-full h-auto" />
                  ) : (
                    <div className="p-6 text-sm text-muted-foreground">No baseline image</div>
                  )}
                </div>

                <div className="border rounded overflow-hidden">
                  <p className="p-2 text-sm font-medium">Current</p>
                  {data.currentImageUrl ? (
                    <img src={data.currentImageUrl} alt="Current" className="w-full h-auto" />
                  ) : (
                    <div className="p-6 text-sm text-muted-foreground">No current image</div>
                  )}
                </div>

                <div className="border rounded overflow-hidden">
                  <p className="p-2 text-sm font-medium">Diff</p>
                  {data.diffImageUrl ? (
                    <img src={data.diffImageUrl} alt="Diff" className="w-full h-auto" />
                  ) : (
                    <div className="p-6 text-sm text-muted-foreground">No diff image</div>
                  )}
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
