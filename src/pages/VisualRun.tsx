import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getApiBaseUrl } from '@/lib/apiBase';

type VisualRunResult = {
  runId: string;
  baselineId: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  errorCode: 'DIMENSION_MISMATCH' | 'CAPTURE_FAILED' | 'COMPARE_FAILED' | null;
  metrics: {
    mismatchPixelCount: number;
    totalPixels: number;
    mismatchPercent: number;
  };
  artifacts: {
    baseline: string;
    current: string;
    diff: string | null;
    resultJson: string;
  };
  createdAt: string;
};

export default function VisualRun() {
  const { baselineId, runId } = useParams();
  const [data, setData] = useState<VisualRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiBase = getApiBaseUrl();

  useEffect(() => {
    if (!baselineId || !runId) return;
    setError(null);
    setData(null);

    fetch(`${apiBase}/api/v1/visual/baselines/${baselineId}/runs/${runId}`)
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text();
          throw new Error(text || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((json) => setData(json))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load run'));
  }, [baselineId, runId]);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Visual Run</h1>
          <p className="text-muted-foreground">
            Baseline: <span className="font-mono text-sm">{baselineId}</span> · Run:{' '}
            <span className="font-mono text-sm">{runId}</span>
          </p>
        </header>

        {error && (
          <Card className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {data && (
          <>
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={data.status === 'PASS' ? 'default' : data.status === 'FAIL' ? 'secondary' : 'destructive'}>
                  {data.status}
                </Badge>
                {data.errorCode && <Badge variant="outline">{data.errorCode}</Badge>}
                <span className="text-sm text-muted-foreground">{new Date(data.createdAt).toLocaleString()}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <p className="text-sm font-medium mb-2">Mismatch Pixels</p>
                  <p className="text-2xl font-bold">{data.metrics.mismatchPixelCount}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm font-medium mb-2">Total Pixels</p>
                  <p className="text-2xl font-bold">{data.metrics.totalPixels}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm font-medium mb-2">Mismatch %</p>
                  <p className="text-2xl font-bold">{data.metrics.mismatchPercent.toFixed(4)}%</p>
                </Card>
              </div>
            </Card>

            <Separator />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Baseline</p>
                  <a className="text-sm underline text-muted-foreground" href={data.artifacts.baseline} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </div>
                <img src={data.artifacts.baseline} alt="Baseline" className="w-full rounded border" />
              </Card>

              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Current</p>
                  {data.artifacts.current ? (
                    <a className="text-sm underline text-muted-foreground" href={data.artifacts.current} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">(missing)</span>
                  )}
                </div>
                {data.artifacts.current ? (
                  <img src={data.artifacts.current} alt="Current" className="w-full rounded border" />
                ) : (
                  <div className="text-sm text-muted-foreground">No current screenshot.</div>
                )}
              </Card>

              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Diff</p>
                  {data.artifacts.diff ? (
                    <a className="text-sm underline text-muted-foreground" href={data.artifacts.diff} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">(none)</span>
                  )}
                </div>
                {data.artifacts.diff ? (
                  <img src={data.artifacts.diff} alt="Diff" className="w-full rounded border" />
                ) : (
                  <div className="text-sm text-muted-foreground">No diff image for this run.</div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
