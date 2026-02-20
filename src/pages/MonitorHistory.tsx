import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getApiBaseUrl } from '@/lib/apiBase';
import { supabase, VISUAL_BUCKET } from '@/lib/supabaseClient';
import { getAuthHeaders } from '@/lib/auth';

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

type RunItem = {
  id: string;
  monitorId: string;
  baselineId: string;
  status: string;
  mismatchPercentage: number;
  diffPixels: number;
  severity: string | null;
  createdAt: string;
  currentUrl: string | null;
  diffUrl: string | null;
  aiStatus: string;
  aiJson: any;
  cssDiffJson: CssDiffItem[] | null;
};

type SignedImages = {
  baselineUrl: string | null;
  currentUrl: string | null;
  diffUrl: string | null;
};

export default function MonitorHistory() {
  const { monitorId } = useParams();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<RunItem | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [signedImages, setSignedImages] = useState<SignedImages>({ baselineUrl: null, currentUrl: null, diffUrl: null });

  const apiBase = getApiBaseUrl();

  const fetchBaselineUrl = async (baselineId: string): Promise<string | null> => {
    try {
      const { data } = await supabase
        .from('design_baselines')
        .select('snapshot_path')
        .eq('id', baselineId)
        .single();
      if (!data?.snapshot_path) return null;
      const { data: signed } = await supabase.storage
        .from(VISUAL_BUCKET)
        .createSignedUrl(data.snapshot_path, 3600);
      return signed?.signedUrl ?? null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!monitorId) return;
    setLoading(true);
    setError(null);

    getAuthHeaders().then((headers) => fetch(`${apiBase}/monitors/${monitorId}/runs`, { headers }))
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text() || `HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setRuns(data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load runs'))
      .finally(() => setLoading(false));
  }, [monitorId, apiBase]);

  const openRunDialog = async (run: RunItem) => {
    setSelectedRun(run);
    setDialogOpen(true);
    setImageLoading(true);
    setSignedImages({ baselineUrl: null, currentUrl: null, diffUrl: null });

    try {
      const baselineUrl = await fetchBaselineUrl(run.baselineId);
      setSignedImages({
        baselineUrl,
        currentUrl: run.currentUrl,
        diffUrl: run.diffUrl,
      });
    } catch {
      // Images may fail to load, that's ok
    } finally {
      setImageLoading(false);
    }
  };

  const getSeverityBadge = (severity: string | null, mismatch: number) => {
    const sev = severity || (mismatch < 2 ? 'minor' : mismatch <= 10 ? 'warning' : 'critical');
    if (sev === 'minor') return <Badge variant="secondary">Minor</Badge>;
    if (sev === 'warning') return <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">Warning</Badge>;
    return <Badge variant="destructive">Critical</Badge>;
  };

  // Chart data: oldest first
  const chartData = [...runs]
    .reverse()
    .map((run) => ({
      date: new Date(run.createdAt).toLocaleDateString(),
      drift: run.mismatchPercentage,
    }));

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => navigate('/')} className="mb-2 -ml-4">
              &larr; Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Monitor History</h1>
            <p className="text-muted-foreground mt-1">
              Monitor: <span className="font-mono text-sm">{monitorId}</span>
              {' '}&middot; {runs.length} run{runs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </header>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Loading run history...</p>
          </Card>
        )}

        {!loading && runs.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No runs found for this monitor.</p>
          </Card>
        )}

        {!loading && chartData.length > 1 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Drift Trend</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 'auto']}
                />
                <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Drift']} />
                <Line
                  type="monotone"
                  dataKey="drift"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {!loading && runs.length > 0 && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Drift %</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>AI</TableHead>
                  <TableHead>CSS</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run, idx) => (
                  <TableRow key={run.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">#{runs.length - idx}</TableCell>
                    <TableCell>
                      <Badge variant={run.status === 'completed' ? 'default' : 'destructive'}>
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{run.mismatchPercentage.toFixed(2)}%</TableCell>
                    <TableCell>{getSeverityBadge(run.severity, run.mismatchPercentage)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {run.aiStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {run.cssDiffJson && run.cssDiffJson.length > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          {run.cssDiffJson.length}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(run.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openRunDialog(run)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle>Run Result</DialogTitle>
              <DialogDescription>
                {selectedRun && (
                  <>
                    Drift: {selectedRun.mismatchPercentage.toFixed(2)}% &middot;{' '}
                    {new Date(selectedRun.createdAt).toLocaleString()}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {imageLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading images...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded overflow-hidden">
                  <p className="p-2 text-sm font-medium">Baseline</p>
                  {signedImages.baselineUrl ? (
                    <img src={signedImages.baselineUrl} alt="Baseline" className="w-full h-auto" />
                  ) : (
                    <div className="p-6 text-sm text-muted-foreground">No baseline image</div>
                  )}
                </div>
                <div className="border rounded overflow-hidden">
                  <p className="p-2 text-sm font-medium">Current</p>
                  {signedImages.currentUrl ? (
                    <img src={signedImages.currentUrl} alt="Current" className="w-full h-auto" />
                  ) : (
                    <div className="p-6 text-sm text-muted-foreground">No current image</div>
                  )}
                </div>
                <div className="border rounded overflow-hidden">
                  <p className="p-2 text-sm font-medium">Diff</p>
                  {signedImages.diffUrl ? (
                    <img src={signedImages.diffUrl} alt="Diff" className="w-full h-auto" />
                  ) : (
                    <div className="p-6 text-sm text-muted-foreground">No diff image</div>
                  )}
                </div>
              </div>
            )}

            {selectedRun?.aiJson && !selectedRun.aiJson.error && (
              <Card className="p-4 mt-4 space-y-3">
                <h3 className="font-semibold">AI Analysis</h3>
                <p className="text-sm text-muted-foreground">{selectedRun.aiJson.summary}</p>
                {selectedRun.aiJson.issues?.length > 0 && (
                  <div className="space-y-2">
                    {selectedRun.aiJson.issues.map((issue: any, idx: number) => (
                      <div key={idx} className="text-sm border-l-2 border-orange-400 pl-3">
                        <p className="font-medium">{issue.title}</p>
                        <p className="text-muted-foreground text-xs">{issue.evidence}</p>
                        {issue.recommendation && (
                          <p className="text-xs text-blue-600 mt-1">{issue.recommendation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {selectedRun?.cssDiffJson && selectedRun.cssDiffJson.length > 0 && (
              <Card className="p-4 mt-4 space-y-3">
                <h3 className="font-semibold">
                  CSS Changes{' '}
                  <span className="text-muted-foreground font-normal text-sm">
                    ({selectedRun.cssDiffJson.length} element{selectedRun.cssDiffJson.length !== 1 ? 's' : ''})
                  </span>
                </h3>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {selectedRun.cssDiffJson.map((diff, idx) => (
                    <div key={idx} className="border rounded p-2 text-xs space-y-1">
                      <p className="font-mono font-medium text-foreground truncate" title={diff.selector}>
                        {diff.selector}
                        {diff.text && (
                          <span className="ml-2 text-muted-foreground font-normal non-italic">
                            "{diff.text.slice(0, 40)}{diff.text.length > 40 ? '…' : ''}"
                          </span>
                        )}
                      </p>
                      {diff.changes.map((change, cidx) => {
                        const categoryColors: Record<string, string> = {
                          typography: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
                          color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
                          spacing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
                          layout: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
                          border: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                          other: 'bg-muted text-muted-foreground',
                        };
                        return (
                          <div key={cidx} className="flex items-center gap-2 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${categoryColors[change.category] || categoryColors.other}`}>
                              {change.category}
                            </span>
                            <span className="font-mono text-muted-foreground shrink-0">{change.property}:</span>
                            <span className="line-through text-red-500 shrink-0">{change.baseline}</span>
                            <span className="text-muted-foreground shrink-0">→</span>
                            <span className="text-green-600 dark:text-green-400 shrink-0">{change.current}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
