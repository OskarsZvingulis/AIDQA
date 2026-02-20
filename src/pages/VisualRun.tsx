import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getApiBaseUrl } from '@/lib/apiBase';
import { getAuthHeaders } from '@/lib/auth';

type AIIssue = {
  title: string;
  location?: string;
  type: 'layout' | 'spacing' | 'typography' | 'color' | 'content' | 'other';
  severity: 'minor' | 'major' | 'critical';
  evidence: string;
  recommendation: string;
};

type CssPropertyChange = {
  property: string;
  baseline: string;
  current: string;
  category: 'typography' | 'color' | 'spacing' | 'layout' | 'border' | 'other';
};

type CssDiffItem = {
  selector: string;
  tag: string;
  text: string;
  changes: CssPropertyChange[];
};

type AIInsights = {
  summary: string;
  severity: 'pass' | 'minor' | 'major' | 'critical';
  issues: AIIssue[];
  quickWins: string[];
  verdict?: string;
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
  cssDiffJson?: CssDiffItem[] | null;
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

    const load = async () => {
      const headers = await getAuthHeaders();
      fetch(`${apiBase}/baselines/${baselineId}/runs/${runId}`, { headers })
        .then(async (r) => {
          if (!r.ok) {
            const text = await r.text();
            throw new Error(text || `HTTP ${r.status}`);
          }
          return r.json();
        })
        .then((json) => setData(json))
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load run'));
    };
    load();
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
            {data.aiJson && !data.aiJson.error && (
              <>
                <Separator />
                <Card className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">AI Quality Analysis</h2>
                    <Badge variant={
                      data.aiJson.severity === 'pass' ? 'default' :
                      data.aiJson.severity === 'minor' ? 'secondary' : 'destructive'
                    }>
                      {data.aiJson.severity.toUpperCase()}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground">{data.aiJson.summary}</p>

                  {data.aiJson.verdict && (
                    <Alert>
                      <AlertTitle>Verdict</AlertTitle>
                      <AlertDescription>{data.aiJson.verdict}</AlertDescription>
                    </Alert>
                  )}

                  {data.aiJson.issues.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-medium text-sm">Issues Detected ({data.aiJson.issues.length})</h3>
                      {data.aiJson.issues.map((issue, idx) => (
                        <Card 
                          key={idx} 
                          className="p-4 border-l-4" 
                          style={{
                            borderLeftColor: 
                              issue.severity === 'critical' ? '#ef4444' :
                              issue.severity === 'major' ? '#f97316' : '#eab308'
                          }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {issue.type}
                                </Badge>
                                <Badge 
                                  variant={
                                    issue.severity === 'critical' ? 'destructive' :
                                    issue.severity === 'major' ? 'destructive' : 'secondary'
                                  } 
                                  className="text-xs"
                                >
                                  {issue.severity}
                                </Badge>
                              </div>
                              <p className="font-medium text-sm">{issue.title}</p>
                              {issue.location && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  📍 {issue.location}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {issue.evidence && (
                            <p className="text-xs text-muted-foreground mb-2 italic">
                              &quot;{issue.evidence}&quot;
                            </p>
                          )}
                          
                          {issue.recommendation && (
                            <p className="text-xs bg-blue-50 dark:bg-blue-950 p-2 rounded">
                              💡 <strong>Fix:</strong> {issue.recommendation}
                            </p>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}

                  {data.aiJson.quickWins.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-medium text-sm">Quick Wins</h3>
                      <ul className="text-xs space-y-1">
                        {data.aiJson.quickWins.map((win, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-green-600">✓</span>
                            <span>{win}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              </>
            )}

            {data.aiJson?.error && (
              <>
                <Separator />
                <Card className="p-6 border-destructive">
                  <p className="text-sm text-destructive font-medium">AI Analysis Failed</p>
                  <p className="text-sm text-muted-foreground mt-2">{data.aiJson.error}</p>
                </Card>
              </>
            )}

            {!data.aiJson && (
              <>
                <Separator />
                <Card className="p-6 border-destructive">
                  <p className="text-sm text-destructive font-medium">AI Missing</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    This run is missing AI insights (this should never happen). Contact support.
                  </p>
                </Card>
              </>
            )}

            {data.cssDiffJson && data.cssDiffJson.length > 0 && (
              <>
                <Separator />
                <Card className="p-6 space-y-4">
                  <h2 className="text-xl font-semibold">
                    CSS Changes
                    <span className="ml-2 text-base font-normal text-muted-foreground">
                      {data.cssDiffJson.length} element{data.cssDiffJson.length !== 1 ? 's' : ''} changed
                    </span>
                  </h2>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {data.cssDiffJson.map((diff, idx) => {
                      const categoryColors: Record<string, string> = {
                        typography: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
                        color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
                        spacing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
                        layout: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
                        border: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                        other: 'bg-muted text-muted-foreground',
                      };
                      return (
                        <Card key={idx} className="p-4 space-y-2">
                          <div className="flex items-start gap-2">
                            <code className="text-sm font-mono font-medium break-all">{diff.selector}</code>
                            {diff.text && (
                              <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                                "{diff.text.slice(0, 50)}{diff.text.length > 50 ? '…' : ''}"
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {diff.changes.map((change, cidx) => (
                              <div key={cidx} className="flex items-center gap-2 text-sm flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium shrink-0 ${categoryColors[change.category] || categoryColors.other}`}>
                                  {change.category}
                                </span>
                                <span className="font-mono text-muted-foreground shrink-0">{change.property}:</span>
                                <span className="line-through text-red-500 shrink-0">{change.baseline}</span>
                                <span className="text-muted-foreground shrink-0">→</span>
                                <span className="text-green-600 dark:text-green-400 font-medium shrink-0">{change.current}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
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
