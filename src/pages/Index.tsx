import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { getApiBaseUrl, validateApiConfig, getApiHeaders } from '@/lib/apiBase';

export default function Index() {
  // Visual regression (MVP) UI state
  const [visualProjectId, setVisualProjectId] = useState('demo');
  const [visualName, setVisualName] = useState('Example.com');
  const [visualUrl, setVisualUrl] = useState('https://example.com');
  const [visualFigmaFileKey, setVisualFigmaFileKey] = useState('');
  const [visualFigmaNodeIds, setVisualFigmaNodeIds] = useState('');
  const [visualUseFigma, setVisualUseFigma] = useState(false);
  const [visualViewportWidth, setVisualViewportWidth] = useState('1440');
  const [visualViewportHeight, setVisualViewportHeight] = useState('900');
  const [visualBaselineId, setVisualBaselineId] = useState<string>('');
  const [visualRunUrl, setVisualRunUrl] = useState<string>('');  // URL to compare against
  const [visualRunId, setVisualRunId] = useState<string>('');
  const [visualStatus, setVisualStatus] = useState<'PASS' | 'FAIL' | 'ERROR' | ''>('');
  const [visualMismatch, setVisualMismatch] = useState<number | null>(null);
  const [visualError, setVisualError] = useState<string | null>(null);
  const [visualLoading, setVisualLoading] = useState(false);
  const apiBase = getApiBaseUrl();

  const parseViewport = () => {
    const width = Number(visualViewportWidth);
    const height = Number(visualViewportHeight);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('Viewport must be positive numbers');
    }
    return { width: Math.floor(width), height: Math.floor(height) };
  };

  const handleCreateBaseline = async () => {
    setVisualError(null);
    setVisualRunId('');
    setVisualStatus('');
    setVisualMismatch(null);
    setVisualLoading(true);
    try {
      const configCheck = validateApiConfig();
      if (!configCheck.valid) {
        throw new Error(configCheck.error);
      }
      const viewport = parseViewport();

      const body: any = {
        projectId: visualProjectId.trim(),
        name: visualName.trim(),
        viewport,
      };

      if (visualUseFigma) {
        if (!visualFigmaFileKey || !visualFigmaNodeIds) {
          throw new Error('Figma file key and node IDs are required when using Figma');
        }
        body.figmaSource = {
          figmaFileKey: visualFigmaFileKey.trim(),
          figmaNodeIds: visualFigmaNodeIds.split(',').map((id: string) => id.trim()),
        };
      } else {
        if (!visualUrl) {
          throw new Error('URL is required when not using Figma');
        }
        body.url = visualUrl.trim();
      }

      console.log('CREATE_BASELINE body =>', body);

      const res = await fetch(`${apiBase}/baselines`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const json = JSON.parse(text);
      
      const baselineId = json.baselineId ?? json.id;
      if (!baselineId) throw new Error(`Unexpected response: ${text}`);
      setVisualBaselineId(baselineId);
    } catch (e) {
      setVisualError(e instanceof Error ? e.message : 'Failed to create baseline');
    } finally {
      setVisualLoading(false);
    }
  };

  const handleCreateRun = async () => {
    if (!visualBaselineId) {
      setVisualError('baselineId is required (create a baseline first)');
      return;
    }
    if (!visualRunUrl || !visualRunUrl.trim()) {
      setVisualError('Enter URL to compare against');
      return;
    }
    setVisualError(null);
    setVisualRunId('');
    setVisualStatus('');
    setVisualMismatch(null);
    setVisualLoading(true);
    try {
      const configCheck = validateApiConfig();
      if (!configCheck.valid) {
        throw new Error(configCheck.error);
      }
      const res = await fetch(`${apiBase}/baselines/${visualBaselineId}/runs`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ url: visualRunUrl.trim() }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const json = JSON.parse(text);
      
      const runId = json.runId ?? json.id;
      if (!runId) throw new Error(`Unexpected response: ${text}`);
      setVisualRunId(runId);
      setVisualStatus(json.status || 'PASS');
      setVisualMismatch(json.diffPixels ?? json.mismatchPixelCount ?? null);
    } catch (e) {
      setVisualError(e instanceof Error ? e.message : 'Failed to create run');
    } finally {
      setVisualLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">AIDQA</h1>
          <p className="text-muted-foreground">
            Automatically scan design files for inconsistencies in design systems, brand standards, and accessibility.
          </p>
        </header>

        {/* Visual Regression (MVP) */}
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Visual Regression (MVP)</h2>
            <p className="text-sm text-muted-foreground">
              Create a baseline screenshot from URL or Figma design, then run exact pixel compare.
            </p>
          </div>

          {visualError && (
            <Alert variant="destructive">
              <AlertDescription>{visualError}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-3 mb-2">
            <Label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                checked={!visualUseFigma} 
                onChange={() => setVisualUseFigma(false)}
              />
              <span>URL</span>
            </Label>
            <Label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                checked={visualUseFigma} 
                onChange={() => setVisualUseFigma(true)}
              />
              <span>Figma</span>
            </Label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="visualProjectId">Project ID</Label>
              <Input id="visualProjectId" value={visualProjectId} onChange={(e) => setVisualProjectId(e.target.value)} />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="visualName">Name</Label>
              <Input id="visualName" value={visualName} onChange={(e) => setVisualName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visualViewportWidth">Viewport W</Label>
              <Input id="visualViewportWidth" value={visualViewportWidth} onChange={(e) => setVisualViewportWidth(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visualViewportHeight">Viewport H</Label>
              <Input id="visualViewportHeight" value={visualViewportHeight} onChange={(e) => setVisualViewportHeight(e.target.value)} />
            </div>
            {!visualUseFigma ? (
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="visualUrl">URL</Label>
                <Input 
                  id="visualUrl" 
                  value={visualUrl} 
                  onChange={(e) => setVisualUrl(e.target.value)}
                  placeholder=""
                  className="placeholder:text-gray-400"
                />
              </div>
            ) : (
              <>
                <div className="space-y-2 lg:col-span-1">
                  <Label htmlFor="visualFigmaFileKey">Figma File Key</Label>
                  <Input 
                    id="visualFigmaFileKey" 
                    value={visualFigmaFileKey} 
                    onChange={(e) => setVisualFigmaFileKey(e.target.value)}
                    placeholder="abc123def456"
                  />
                </div>
                <div className="space-y-2 lg:col-span-1">
                  <Label htmlFor="visualFigmaNodeIds">Node IDs (comma-separated)</Label>
                  <Input 
                    id="visualFigmaNodeIds" 
                    value={visualFigmaNodeIds} 
                    onChange={(e) => setVisualFigmaNodeIds(e.target.value)}
                    placeholder="1:23, 2:45"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleCreateBaseline} disabled={visualLoading}>
              Create baseline
            </Button>
            <div className="flex items-center gap-2">
              <Label htmlFor="visualBaselineId">Baseline ID</Label>
              <Input
                id="visualBaselineId"
                value={visualBaselineId}
                onChange={(e) => setVisualBaselineId(e.target.value)}
                className="w-[420px] max-w-full font-mono"
                placeholder="(created baselineId appears here)"
              />
            </div>
          </div>

          {visualBaselineId && (
            <div className="space-y-2">
              <Label htmlFor="visualRunUrl">Compare against URL</Label>
              <Input
                id="visualRunUrl"
                value={visualRunUrl}
                onChange={(e) => setVisualRunUrl(e.target.value)}
                placeholder="https://..."
                className="w-full"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleCreateRun} disabled={visualLoading || !visualBaselineId}>
              Create run
            </Button>
          </div>

          {(visualRunId || visualStatus) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {visualStatus && (
                <Badge variant={visualStatus === 'PASS' ? 'default' : visualStatus === 'FAIL' ? 'secondary' : 'destructive'}>
                  {visualStatus}
                </Badge>
              )}
              {visualMismatch !== null && <span className="text-muted-foreground">mismatchPixelCount: {visualMismatch}</span>}
              {visualBaselineId && visualRunId && (
                <Link className="underline" to={`/visual/baselines/${visualBaselineId}/runs/${visualRunId}`}>
                  Open run viewer
                </Link>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
