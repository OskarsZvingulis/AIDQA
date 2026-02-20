import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getApiBaseUrl } from '@/lib/apiBase';
import { supabase, VISUAL_BUCKET } from '@/lib/supabaseClient';
import { getAuthHeaders } from '@/lib/auth';
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

type MonitorItem = {
  monitorId: string;
  baselineName: string;
  enabled: boolean;
  targetUrl: string;
};

type VisualRunRow = {
  id: string;
  monitor_id: string | null;
  baseline_id: string;
  status: string;
  mismatch_percentage: number | string;
  created_at: string;
  current_path: string | null;
  diff_path: string | null;
};

type BaselinePathRow = {
  id: string;
  snapshot_path: string;
};

type DashboardMonitorRow = {
  monitor: MonitorItem;
  latestRun: VisualRunRow | null;
  baselinePath: string | null;
};

type SignedImages = {
  baselineUrl: string | null;
  currentUrl: string | null;
  diffUrl: string | null;
};

export default function Dashboard() {
  const [rows, setRows] = useState<DashboardMonitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<DashboardMonitorRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [signedImages, setSignedImages] = useState<SignedImages>({
    baselineUrl: null,
    currentUrl: null,
    diffUrl: null,
  });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [deletingMonitorId, setDeletingMonitorId] = useState<string | null>(null);
  const navigate = useNavigate();
  const apiBase = getApiBaseUrl();

  const createSignedUrl = async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    const { data, error } = await supabase.storage.from(VISUAL_BUCKET).createSignedUrl(path, 3600);
    if (error) throw new Error(error.message || 'Failed to sign URL');
    return data?.signedUrl ?? null;
  };

  const getLatestRunByMonitor = (runs: VisualRunRow[]) => {
    const latest = new Map<string, VisualRunRow>();
    for (const run of runs) {
      if (!run.monitor_id) continue;
      if (!latest.has(run.monitor_id)) {
        latest.set(run.monitor_id, run);
      }
    }
    return latest;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    setError(null);
    setLoading(true);
    const load = async () => {
      try {
        const headers = await getAuthHeaders();
        const monitorsResponse = await fetch(`${apiBase}/monitors`, { headers });

        if (!monitorsResponse.ok) {
          const text = await monitorsResponse.text();
          throw new Error(text || `HTTP ${monitorsResponse.status}`);
        }

        const monitorsJson = (await monitorsResponse.json()) as MonitorItem[];
        const monitors = monitorsJson || [];

        // RLS on visual_runs filters to the authenticated user automatically
        const { data: runs, error: runsError } = await supabase
          .from('visual_runs')
          .select('id,monitor_id,baseline_id,status,mismatch_percentage,created_at,current_path,diff_path')
          .order('created_at', { ascending: false })
          .limit(200);

        if (runsError) throw new Error(runsError.message || 'Failed to load runs');

        const latestByMonitor = getLatestRunByMonitor(runs || []);

        const baselineIds = Array.from(
          new Set(Array.from(latestByMonitor.values()).map((run) => run.baseline_id).filter(Boolean))
        );

        const baselinePathById = new Map<string, string>();
        if (baselineIds.length > 0) {
          const { data: baselines, error: baselinesError } = await supabase
            .from('design_baselines')
            .select('id,snapshot_path')
            .in('id', baselineIds);

          if (baselinesError) throw new Error(baselinesError.message || 'Failed to load baselines');

          for (const baseline of baselines || []) {
            baselinePathById.set(baseline.id, baseline.snapshot_path);
          }
        }

        const combinedRows: DashboardMonitorRow[] = monitors.map((monitor) => {
          const latestRun = latestByMonitor.get(monitor.monitorId) || null;
          const baselinePath = latestRun ? baselinePathById.get(latestRun.baseline_id) || null : null;
          return { monitor, latestRun, baselinePath };
        });

        setRows(combinedRows);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [apiBase]);

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">No runs yet</Badge>;
    if (status === 'completed') return <Badge variant="default">Completed</Badge>;
    if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const handleDeleteMonitor = async (monitorId: string) => {
    if (!window.confirm('Delete this monitor and all its runs? This cannot be undone.')) return;
    setDeletingMonitorId(monitorId);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/monitors/${monitorId}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      setRows((prev) => prev.filter((r) => r.monitor.monitorId !== monitorId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete monitor');
    } finally {
      setDeletingMonitorId(null);
    }
  };

  const openResultDialog = async (row: DashboardMonitorRow) => {
    setSelectedRow(row);
    setDialogOpen(true);
    setImageError(null);
    setImageLoading(true);
    setSignedImages({ baselineUrl: null, currentUrl: null, diffUrl: null });

    try {
      const [baselineUrl, currentUrl, diffUrl] = await Promise.all([
        createSignedUrl(row.baselinePath),
        createSignedUrl(row.latestRun?.current_path || null),
        createSignedUrl(row.latestRun?.diff_path || null),
      ]);

      setSignedImages({ baselineUrl, currentUrl, diffUrl });
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'Failed to load result images');
    } finally {
      setImageLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">AIDQA Dashboard</h1>
            <p className="text-muted-foreground mt-1">Monitor your visual regression tests</p>
          </div>
          <div className="flex items-center gap-3">
            {userEmail && (
              <span className="text-sm text-muted-foreground">{userEmail}</span>
            )}
            <Button onClick={() => navigate('/create-monitor')} size="lg">
              + Add Monitor
            </Button>
            <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}>
              Sign out
            </Button>
          </div>
        </header>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Loading monitors and latest runs...</p>
          </Card>
        )}

        {!loading && rows.length === 0 && (
          <Card className="p-8 text-center space-y-4">
            <p className="text-muted-foreground">No monitors yet. Create your first monitor to get started.</p>
            <Button onClick={() => navigate('/create-monitor')}>+ Add Monitor</Button>
          </Card>
        )}

        {!loading && rows.length > 0 && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Monitor Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Drift %</TableHead>
                  <TableHead>Last Check</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const latestRun = row.latestRun;
                  const hasRun = !!latestRun;
                  const canView =
                    !!latestRun &&
                    latestRun.status === 'completed' &&
                    !!row.baselinePath &&
                    !!latestRun.current_path;

                  return (
                  <TableRow key={row.monitor.monitorId} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{row.monitor.baselineName}</TableCell>
                    <TableCell>{getStatusBadge(latestRun?.status || null)}</TableCell>
                    <TableCell>
                      {hasRun
                        ? `${Number(latestRun?.mismatch_percentage || 0).toFixed(2)}%`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {hasRun && latestRun?.created_at
                        ? new Date(latestRun.created_at).toLocaleString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {hasRun ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResultDialog(row)}
                            disabled={!canView || imageLoading}
                          >
                            View Result
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">No runs yet</span>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteMonitor(row.monitor.monitorId)}
                          disabled={deletingMonitorId === row.monitor.monitorId}
                        >
                          {deletingMonitorId === row.monitor.monitorId ? 'Deleting…' : 'Delete'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle>Latest Run Result</DialogTitle>
              <DialogDescription>
                {selectedRow?.monitor.baselineName || 'Monitor result'}
              </DialogDescription>
            </DialogHeader>

            {imageError && (
              <Alert variant="destructive">
                <AlertDescription>{imageError}</AlertDescription>
              </Alert>
            )}

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
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => { setDialogOpen(false); setSelectedRow(null); }}>
                Back
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
