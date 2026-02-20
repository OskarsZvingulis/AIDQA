import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getApiBaseUrl, validateApiConfig } from '@/lib/apiBase';
import { getAuthHeaders } from '@/lib/auth';
import { supabase, VISUAL_BUCKET } from '@/lib/supabaseClient';

type DevicePreset = 'desktop' | 'tablet' | 'mobile' | 'custom';

type AIIssue = {
  title: string;
  location: string;
  type: string;
  severity: string;
  evidence: string;
  recommendation: string;
};

type AIInsights = {
  summary: string;
  severity: string;
  issues: AIIssue[];
  quickWins: string[];
};

type CssChange = {
  property: string;
  baseline: string;
  current: string;
  category: string;
};

type CssDiffItem = {
  selector: string;
  tag: string;
  text: string;
  changes: CssChange[];
};

export default function Index() {
  // Step 1: Create Baseline
  const [baselineName, setBaselineName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [devicePreset, setDevicePreset] = useState<DevicePreset>('desktop');
  const [viewportWidth, setViewportWidth] = useState('1440');
  const [viewportHeight, setViewportHeight] = useState('900');
  
  // Step 1 result state
  const [baselineId, setBaselineId] = useState<string>('');
  const [baselinePreviewUrl, setBaselinePreviewUrl] = useState<string>('');
  const [baselineApproved, setBaselineApproved] = useState(false);
  
  // Step 2: Create Monitor
  const [targetUrl, setTargetUrl] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('aidqa_target_url') || '';
  });
  const [cadence, setCadence] = useState<'hourly' | 'daily'>('daily');
  const [monitorId, setMonitorId] = useState<string>('');
  const [monitorMismatchPercentage, setMonitorMismatchPercentage] = useState<number | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonStatusMessage, setComparisonStatusMessage] = useState<string | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [baselineImageUrl, setBaselineImageUrl] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [diffImageUrl, setDiffImageUrl] = useState<string | null>(null);
  const [aiData, setAiData] = useState<AIInsights | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [cssDiffData, setCssDiffData] = useState<CssDiffItem[] | null>(null);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [monitorLoading, setMonitorLoading] = useState(false);
  
  const apiBase = getApiBaseUrl();
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const monitorCreatingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('aidqa_target_url', targetUrl);
  }, [targetUrl]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current !== null) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleDeviceChange = (value: DevicePreset) => {
    setDevicePreset(value);
    switch (value) {
      case 'desktop':
        setViewportWidth('1440');
        setViewportHeight('900');
        break;
      case 'tablet':
        setViewportWidth('768');
        setViewportHeight('1024');
        break;
      case 'mobile':
        setViewportWidth('390');
        setViewportHeight('844');
        break;
      case 'custom':
        // Keep current values
        break;
    }
  };

  const parseViewport = () => {
    const width = Number(viewportWidth);
    const height = Number(viewportHeight);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('Viewport must be positive numbers');
    }
    return { width: Math.floor(width), height: Math.floor(height) };
  };

  const createSignedUrl = async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from(VISUAL_BUCKET)
      .createSignedUrl(path, 60);

    if (error) throw new Error(error.message || 'Failed to create signed URL');
    return data?.signedUrl || null;
  };

  const stopPolling = () => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const loadLatestRunComparison = (createdMonitorId: string) => {
    stopPolling();
    setComparisonStatusMessage('Processing run...');
    setComparisonError(null);
    setComparisonLoading(true);
    setBaselineImageUrl(null);
    setCurrentImageUrl(null);
    setDiffImageUrl(null);
    setAiData(null);
    setAiStatus(null);
    setCssDiffData(null);

    const startTime = Date.now();

    const tick = async () => {
      try {
        const { data: latestRun, error: runError } = await supabase
          .from('visual_runs')
          .select('*')
          .eq('monitor_id', createdMonitorId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (runError) {
          stopPolling();
          setComparisonError(runError.message || 'Failed to load run');
          setComparisonStatusMessage(null);
          setComparisonLoading(false);
          return;
        }

        const timedOut = Date.now() - startTime > 30_000;

        const aiSettled =
          latestRun?.ai_status === 'completed' || latestRun?.ai_status === 'failed';

        if (
          !latestRun ||
          latestRun.status !== 'completed' ||
          latestRun.mismatch_percentage === null ||
          !aiSettled
        ) {
          if (timedOut) {
            stopPolling();
            setComparisonStatusMessage('Run timed out');
            setComparisonLoading(false);
          }
          return; // keep polling
        }

        // Row exists, status=completed, mismatch_percentage set — load images
        stopPolling();

        setAiStatus(latestRun.ai_status ?? null);
        if (latestRun.ai_status === 'completed' && latestRun.ai_json) {
          setAiData(latestRun.ai_json as AIInsights);
        }
        if (latestRun.css_diff_json) {
          setCssDiffData(latestRun.css_diff_json as CssDiffItem[]);
        }

        const mismatch = Number(latestRun.mismatch_percentage ?? 0);
        if (Number.isFinite(mismatch)) setMonitorMismatchPercentage(mismatch);

        const { data: baselineRows, error: baselineError } = await supabase
          .from('design_baselines')
          .select('snapshot_path')
          .eq('id', latestRun.baseline_id)
          .limit(1);

        if (baselineError) throw new Error(baselineError.message || 'Failed to load baseline path');

        const snapshotPath = baselineRows?.[0]?.snapshot_path || null;

        const [signedBaseline, signedCurrent, signedDiff] = await Promise.all([
          createSignedUrl(snapshotPath),
          createSignedUrl(latestRun.current_path || null),
          createSignedUrl(latestRun.diff_path || null),
        ]);

        setBaselineImageUrl(signedBaseline ?? (baselinePreviewUrl || null));
        setCurrentImageUrl(signedCurrent);
        setDiffImageUrl(signedDiff);
        setComparisonStatusMessage(null);
        setComparisonLoading(false);
      } catch (e) {
        stopPolling();
        setComparisonError(e instanceof Error ? e.message : 'Failed to load comparison images');
        setComparisonStatusMessage(null);
        setComparisonLoading(false);
      }
    };

    tick(); // run immediately
    pollIntervalRef.current = setInterval(tick, 1500);
  };

  const handleCaptureBaseline = async () => {
    setError(null);
    setLoading(true);
    try {
      const configCheck = validateApiConfig();
      if (!configCheck.valid) {
        throw new Error(configCheck.error);
      }

      if (!baselineName.trim()) {
        throw new Error('Baseline name is required');
      }

      if (!sourceUrl.trim()) {
        throw new Error('Source URL is required');
      }

      const viewport = parseViewport();

      const body = {
        name: baselineName.trim(),
        sourceType: 'url',
        sourceUrl: sourceUrl.trim(),
        viewport,
      };

      const res = await fetch(`${apiBase}/baselines`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const json = await res.json();
      const id = json.baselineId ?? json.baseline?.id;
      const previewUrl = json.previewUrl ?? null;
      if (!id) throw new Error('Invalid response: missing baselineId');

      setBaselineId(id);
      if (previewUrl) setBaselinePreviewUrl(previewUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to capture baseline');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBaseline = async () => {
    setError(null);
    setApproveLoading(true);
    try {
      const res = await fetch(`${apiBase}/baselines/${baselineId}/approve`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      setBaselineApproved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve baseline');
    } finally {
      setApproveLoading(false);
    }
  };

  const handleStartMonitoring = async () => {
    if (monitorCreatingRef.current) return;
    monitorCreatingRef.current = true;
    setError(null);
    setComparisonStatusMessage(null);
    setComparisonError(null);
    setMonitorLoading(true);
    try {
      if (!targetUrl.trim()) {
        throw new Error('Target URL is required');
      }

      const body = {
        baselineId,
        targetUrl: targetUrl.trim(),
        cadence,
      };

      const res = await fetch(`${apiBase}/monitors`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const json = await res.json();
      const id = json.monitorId;
      const mismatchPercentage = Number(json.mismatchPercentage);
      
      if (!id) throw new Error('Invalid response: missing monitorId');
      if (!Number.isFinite(mismatchPercentage)) {
        throw new Error('Invalid response: missing mismatchPercentage');
      }

      setMonitorId(id);
      setMonitorMismatchPercentage(mismatchPercentage);
      loadLatestRunComparison(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create monitor');
      monitorCreatingRef.current = false;
    } finally {
      setMonitorLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-3xl space-y-8">
        <header className="text-center space-y-3">
          <h1 className="text-5xl font-bold tracking-tight">AIDQA</h1>
          <p className="text-lg text-muted-foreground">
            Continuous visual monitoring for your web applications
          </p>
        </header>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Create Baseline */}
        <Card className="p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                1
              </div>
              <h2 className="text-2xl font-semibold">Create Baseline</h2>
            </div>
            <p className="text-sm text-muted-foreground pl-10">
              Capture a screenshot from your design or staging environment to use as the reference baseline.
            </p>
          </div>

          <div className="space-y-5 pl-10">
            <div className="space-y-2">
              <Label htmlFor="baselineName" className="text-base font-medium">Baseline Name</Label>
              <Input 
                id="baselineName" 
                value={baselineName} 
                onChange={(e) => setBaselineName(e.target.value)}
                placeholder="e.g., Homepage Desktop, Checkout Flow"
                className="h-11"
                disabled={!!baselineId}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceUrl" className="text-base font-medium">Source URL</Label>
              <Input 
                id="sourceUrl" 
                value={sourceUrl} 
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://staging.example.com"
                className="h-11"
                disabled={!!baselineId}
              />
              <p className="text-xs text-muted-foreground">
                URL of your staging/design environment to capture the baseline from
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="devicePreset" className="text-base font-medium">Device Type</Label>
              <Select value={devicePreset} onValueChange={handleDeviceChange} disabled={!!baselineId}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desktop">Desktop (1440×900)</SelectItem>
                  <SelectItem value="tablet">Tablet (768×1024)</SelectItem>
                  <SelectItem value="mobile">Mobile (390×844)</SelectItem>
                  <SelectItem value="custom">Custom Size</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {devicePreset === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="viewportWidth">Width (px)</Label>
                  <Input 
                    id="viewportWidth" 
                    value={viewportWidth} 
                    onChange={(e) => setViewportWidth(e.target.value)}
                    placeholder="1440"
                    type="number"
                    disabled={!!baselineId}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="viewportHeight">Height (px)</Label>
                  <Input 
                    id="viewportHeight" 
                    value={viewportHeight} 
                    onChange={(e) => setViewportHeight(e.target.value)}
                    placeholder="900"
                    type="number"
                    disabled={!!baselineId}
                  />
                </div>
              </div>
            )}

            {!baselineId && (
              <Button 
                onClick={handleCaptureBaseline} 
                disabled={loading}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                {loading ? 'Capturing baseline...' : 'Capture Baseline'}
              </Button>
            )}

            {baselineId && baselinePreviewUrl && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label className="text-base font-medium">Preview</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <img 
                      src={baselinePreviewUrl} 
                      alt="Baseline preview" 
                      className="w-full h-auto"
                    />
                  </div>
                </div>

                {!baselineApproved && (
                  <Button 
                    onClick={handleApproveBaseline} 
                    disabled={approveLoading}
                    className="w-full h-12 text-base font-semibold"
                    size="lg"
                  >
                    {approveLoading ? 'Approving...' : 'Approve Baseline'}
                  </Button>
                )}

                {baselineApproved && (
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-sm">
                      ✓ Baseline Approved
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Step 2: Create Monitor (only shown after approval) */}
        {baselineApproved && (
          <Card className="p-8 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                  2
                </div>
                <h2 className="text-2xl font-semibold">Create Monitor</h2>
              </div>
              <p className="text-sm text-muted-foreground pl-10">
                Set up continuous monitoring for your production URL against the approved baseline.
              </p>
            </div>

            <div className="space-y-5 pl-10">
              <div className="space-y-2">
                <Label htmlFor="targetUrl" className="text-base font-medium">Target URL (Production)</Label>
                <Input 
                  id="targetUrl" 
                  value={targetUrl} 
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="h-11"
                  disabled={!!monitorId}
                />
                <p className="text-xs text-muted-foreground">
                  Production URL to monitor for visual changes
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cadence" className="text-base font-medium">Check Frequency</Label>
                <Select value={cadence} onValueChange={(v) => setCadence(v as 'hourly' | 'daily')} disabled={!!monitorId}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!monitorId && (
                <Button 
                  onClick={handleStartMonitoring} 
                  disabled={monitorLoading}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  {monitorLoading ? 'Starting monitoring...' : 'Start Monitoring'}
                </Button>
              )}

              {monitorMismatchPercentage !== null && (
                <Card className="p-4 border">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Immediate Result</p>
                    <p className="text-2xl font-bold">Drift %: {monitorMismatchPercentage.toFixed(2)}%</p>
                    <p className="text-sm font-medium">
                      {monitorMismatchPercentage === 0
                        ? 'No visual drift detected'
                        : 'Visual drift detected'}
                    </p>
                  </div>
                </Card>
              )}

              {comparisonLoading && (
                <Card className="p-4 border">
                  <p className="text-sm text-muted-foreground">Generating comparison...</p>
                </Card>
              )}

              {comparisonStatusMessage && !comparisonLoading && (
                <Card className="p-4 border">
                  <p className="text-sm text-muted-foreground">{comparisonStatusMessage}</p>
                </Card>
              )}

              {comparisonError && (
                <Alert variant="destructive">
                  <AlertDescription>{comparisonError}</AlertDescription>
                </Alert>
              )}

              {(baselineImageUrl || currentImageUrl || diffImageUrl || monitorMismatchPercentage !== null) && !comparisonLoading && !comparisonStatusMessage && (
                <Card className="p-4 border space-y-3">
                  <div className={`grid grid-cols-1 ${monitorMismatchPercentage === 0 || !diffImageUrl ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
                    <div className="border rounded overflow-hidden">
                      <p className="p-2 text-sm font-medium">Baseline</p>
                      {baselineImageUrl ? (
                        <img src={baselineImageUrl} alt="Baseline" className="w-full h-auto" />
                      ) : (
                        <div className="p-6 text-sm text-muted-foreground">No baseline image</div>
                      )}
                    </div>

                    <div className="border rounded overflow-hidden">
                      <p className="p-2 text-sm font-medium">Current</p>
                      {currentImageUrl ? (
                        <img src={currentImageUrl} alt="Current" className="w-full h-auto" />
                      ) : (
                        <div className="p-6 text-sm text-muted-foreground">No current image</div>
                      )}
                    </div>

                    {!(monitorMismatchPercentage === 0 || !diffImageUrl) && (
                      <div className="border rounded overflow-hidden">
                        <p className="p-2 text-sm font-medium">Diff</p>
                        <img src={diffImageUrl} alt="Diff" className="w-full h-auto" />
                      </div>
                    )}
                  </div>

                  {(monitorMismatchPercentage === 0 || !diffImageUrl) && (
                    <p className="text-sm text-muted-foreground">No visual differences detected</p>
                  )}
                </Card>
              )}

              {/* AI Analysis */}
              {(aiData || aiStatus === 'failed') && (
                <Card className="p-4 border space-y-5">
                  <p className="text-sm font-bold tracking-tight">AI Analysis</p>

                  {aiStatus === 'failed' && !aiData && (
                    <p className="text-xs text-muted-foreground">
                      AI analysis failed for this run.
                    </p>
                  )}

                  {aiData && (
                    <>
                      {/* Summary */}
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">Summary</p>
                        <p className="text-sm text-muted-foreground">{aiData.summary}</p>
                      </div>

                      {/* Severity */}
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">Severity</p>
                        <Badge
                          variant={
                            aiData.severity === 'critical' || aiData.severity === 'major'
                              ? 'destructive'
                              : aiData.severity === 'pass'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {aiData.severity}
                        </Badge>
                      </div>

                      {/* Quick Wins */}
                      {aiData.quickWins && aiData.quickWins.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">Quick Wins</p>
                          <ul className="list-disc list-inside space-y-1">
                            {aiData.quickWins.map((win, i) => (
                              <li key={i} className="text-sm text-muted-foreground">{win}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Issues */}
                      {aiData.issues.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">
                            Issues ({aiData.issues.length})
                          </p>
                          <ul className="space-y-3">
                            {aiData.issues.map((issue, i) => (
                              <li key={i} className="border rounded p-3 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium">{issue.title}</p>
                                  <Badge
                                    variant={
                                      issue.severity === 'critical'
                                        ? 'destructive'
                                        : issue.severity === 'major'
                                        ? 'destructive'
                                        : 'secondary'
                                    }
                                    className="text-xs"
                                  >
                                    {issue.severity}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">Location: </span>
                                  {issue.location}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">Evidence: </span>
                                  {issue.evidence}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">Recommendation: </span>
                                  {issue.recommendation}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              )}

              {/* CSS Diff */}
              {cssDiffData && cssDiffData.length > 0 && (
                <Card className="p-4 border space-y-4">
                  <p className="text-sm font-semibold">
                    CSS Changes ({cssDiffData.length} element{cssDiffData.length !== 1 ? 's' : ''})
                  </p>
                  <ul className="space-y-3">
                    {cssDiffData.map((item, i) => (
                      <li key={i} className="border rounded p-3 space-y-2">
                        <div>
                          <p className="text-xs font-mono text-muted-foreground break-all">{item.selector}</p>
                          {item.text && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">"{item.text}"</p>
                          )}
                        </div>
                        <ul className="space-y-1">
                          {item.changes.map((change, j) => (
                            <li key={j} className="grid grid-cols-[auto_1fr_1fr] gap-x-3 text-xs items-start">
                              <span className="font-mono text-muted-foreground whitespace-nowrap">
                                {change.property}
                              </span>
                              <span className="font-mono truncate text-red-500" title={change.baseline}>
                                {change.baseline}
                              </span>
                              <span className="font-mono truncate text-green-600" title={change.current}>
                                {change.current}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Powered by AI-assisted visual regression testing
        </p>
      </div>
    </div>
  );
}
