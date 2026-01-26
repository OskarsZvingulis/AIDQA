import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getApiBaseUrl } from '@/lib/apiBase';

type AIIssue = {
  title: string;
  type: 'layout' | 'spacing' | 'typography' | 'color' | 'missing_element' | 'overflow' | 'alignment' | 'other';
  severity: 'minor' | 'major';
  evidence: string;
  recommendation: string;
};

type AIInsights = {
  summary: string;
  severity: 'pass' | 'minor' | 'major';
  issues: AIIssue[];
  quickWins: string[];
};

type VisualRunResult = {
  id: string;
  baselineId: string;
  projectId: string;
  createdAt: string;
  status: 'completed' | 'failed';
  mismatchPercentage: number;
  diffPixels: number;
  currentUrl: string;
  diffUrl: string | null;
  baselineUrl?: string;
  aiJson?: AIInsights | null;
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
                <Badge variant={data.status === 'completed' ? 'default' : 'destructive'}>
                  {data.status.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">{new Date(data.createdAt).toLocaleString()}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <p className="text-sm font-medium mb-2">Mismatch Pixels</p>
                  <p className="text-2xl font-bold">{data.diffPixels.toLocaleString()}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm font-medium mb-2">Mismatch %</p>
                  <p className="text-2xl font-bold">{data.mismatchPercentage.toFixed(4)}%</p>
                </Card>
              </div>
            </Card>

            {/* AI Insights Panel */}
            {data.aiJson && (
              <>
                <Separator />
                <Card className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">AI Insights</h2>
                    <Badge variant={
                      data.aiJson.severity === 'pass' ? 'default' :
                      data.aiJson.severity === 'minor' ? 'secondary' : 'destructive'
                    }>
                      {data.aiJson.severity.toUpperCase()}
                    </Badge>
                  </div>

                  <Alert>
                    <AlertTitle>Summary</AlertTitle>
                    <AlertDescription>{data.aiJson.summary}</AlertDescription>
                  </Alert>

                  {data.aiJson.issues.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm">Issues Detected ({data.aiJson.issues.length})</h3>
                      {data.aiJson.issues.map((issue, idx) => (
                        <Card key={idx} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium">{issue.title}</h4>
                            <div className="flex gap-2">
                              <Badge variant="outline">{issue.type}</Badge>
                              <Badge variant={issue.severity === 'major' ? 'destructive' : 'secondary'}>
                                {issue.severity}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{issue.evidence}</p>
                          <div className="pt-2 border-t">
                            <p className="text-sm font-medium">Recommendation:</p>
                            <p className="text-sm">{issue.recommendation}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {data.aiJson.quickWins.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">Quick Wins</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {data.aiJson.quickWins.map((win, idx) => (
                          <li key={idx} className="text-sm">{win}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              </>
            )}

            {!data.aiJson && (
              <>
                <Separator />
                <Card className="p-6">
                  <p className="text-sm text-muted-foreground">
                    AI insights are disabled. Set OPENAI_API_KEY to enable AI-powered visual regression analysis.
                  </p>
                </Card>
              </>
            )}

            <Separator />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {data.baselineUrl && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Baseline</p>
                    <a href={data.baselineUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                      View
                    </a>
                  </div>
                  <img src={data.baselineUrl} alt="Baseline" className="w-full rounded border" />
                </Card>
              )}

              {data.currentUrl && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Current</p>
                    <a href={data.currentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                      View
                    </a>
                  </div>
                  <img src={data.currentUrl} alt="Current" className="w-full rounded border" />
                </Card>
              )}

              {data.diffUrl && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Diff</p>
                    <a href={data.diffUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                      View
                    </a>
                  </div>
                  <img src={data.diffUrl} alt="Diff" className="w-full rounded border" />
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
