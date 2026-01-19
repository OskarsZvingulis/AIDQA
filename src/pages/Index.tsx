import { useState } from 'react';
import { analyzeDesign, DesignSystem, DesignNode, AnalyzeResult, defaultDesignSystem } from '@/core';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { getApiBaseUrl } from '@/lib/apiBase';

const EXAMPLE_DESIGN_NODE = `{
  "id": "root",
  "name": "Login Screen",
  "type": "FRAME",
  "children": [
    {
      "id": "btn-1",
      "name": "Submit Button",
      "type": "RECTANGLE",
      "fills": [{ "type": "SOLID", "color": { "r": 0.1, "g": 0.5, "b": 0.9 } }],
      "spacing": 18,
      "componentName": "Button/Custom"
    },
    {
      "id": "txt-1",
      "name": "Heading",
      "type": "TEXT",
      "textStyle": "Heading1",
      "foregroundColor": { "r": 0.5, "g": 0.5, "b": 0.5 },
      "backgroundColor": { "r": 1, "g": 1, "b": 1 }
    }
  ]
}`;

// defaultDesignSystem is imported from core and used to populate the JSON editor

export default function Index() {
  const [designSystemJson, setDesignSystemJson] = useState(() => JSON.stringify(defaultDesignSystem, null, 2));
  const [designJson, setDesignJson] = useState(EXAMPLE_DESIGN_NODE);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

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
      if (!apiBase && !import.meta.env.DEV) {
        throw new Error('Visual Regression API is not configured for this deployment. Set VITE_API_BASE_URL to your API host (or run locally).');
      }
      const viewport = parseViewport();

      const body: any = {
        projectId: visualProjectId,
        name: visualName,
        viewport,
      };

      if (visualUseFigma) {
        if (!visualFigmaFileKey || !visualFigmaNodeIds) {
          throw new Error('Figma file key and node IDs are required when using Figma');
        }
        body.figmaSource = {
          figmaFileKey: visualFigmaFileKey,
          figmaNodeIds: visualFigmaNodeIds.split(',').map(id => id.trim()),
        };
      } else {
        if (!visualUrl) {
          throw new Error('URL is required when not using Figma');
        }
        body.url = visualUrl;
      }

      const res = await fetch(`${apiBase}/api/v1/visual/baselines`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const json = JSON.parse(text) as { baselineId: string };
      setVisualBaselineId(json.baselineId);
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
    setVisualError(null);
    setVisualRunId('');
    setVisualStatus('');
    setVisualMismatch(null);
    setVisualLoading(true);
    try {
      if (!apiBase && !import.meta.env.DEV) {
        throw new Error('Visual Regression API is not configured for this deployment. Set VITE_API_BASE_URL to your API host (or run locally).');
      }
      const viewport = parseViewport();
      const res = await fetch(`${apiBase}/api/v1/visual/baselines/${visualBaselineId}/runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ viewport }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const json = JSON.parse(text) as {
        runId: string;
        status: 'PASS' | 'FAIL' | 'ERROR';
        metrics: { mismatchPixelCount: number };
      };
      setVisualRunId(json.runId);
      setVisualStatus(json.status);
      setVisualMismatch(json.metrics?.mismatchPixelCount ?? null);
    } catch (e) {
      setVisualError(e instanceof Error ? e.message : 'Failed to create run');
    } finally {
      setVisualLoading(false);
    }
  };

  const handleAnalyze = () => {
    setError(null);
    setResult(null);

    try {
      const designNode: DesignNode = JSON.parse(designJson);
      const parsedSystem: DesignSystem = JSON.parse(designSystemJson);

      const analysisResult = analyzeDesign(designNode, parsedSystem);
      setResult(analysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON or run analysis');
    }
  };

  const filteredIssues = result?.issues.filter(issue => 
    !filterType || issue.type === filterType
  ) || [];

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
            {!visualUseFigma ? (
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="visualUrl">URL</Label>
                <Input id="visualUrl" value={visualUrl} onChange={(e) => setVisualUrl(e.target.value)} />
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
            <div className="space-y-2">
              <Label htmlFor="visualViewportWidth">Viewport W</Label>
              <Input id="visualViewportWidth" value={visualViewportWidth} onChange={(e) => setVisualViewportWidth(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visualViewportHeight">Viewport H</Label>
              <Input id="visualViewportHeight" value={visualViewportHeight} onChange={(e) => setVisualViewportHeight(e.target.value)} />
            </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel: Design System */}
          <Card className="p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Design System</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Configure your design system tokens that will be used for validation.
              </p>
            </div>

            <div className="space-y-4">
              <Label htmlFor="designSystemJson">Design System (JSON)</Label>
              <Textarea
                id="designSystemJson"
                value={designSystemJson}
                onChange={(e) => setDesignSystemJson(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground">
                Edit the full design system JSON. This will be parsed and used for analysis when you click "Run Analysis".
              </p>
            </div>
          </Card>

          {/* Right Panel: Design Tree JSON */}
          <Card className="p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Design Tree JSON</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Paste JSON representing your design tree structure.
              </p>
            </div>

            <div className="space-y-4">
              <Textarea
                value={designJson}
                onChange={(e) => setDesignJson(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                placeholder="Paste your design node JSON here..."
              />
              
              <Button onClick={handleAnalyze} className="w-full" size="lg">
                Run Analysis
              </Button>
            </div>
          </Card>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-6">
            <Separator />
            
            {/* Summary */}
            <Card className="p-6">
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Analysis Results</h2>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold">{result.totalIssues}</span>
                  <span className="text-muted-foreground">total inconsistencies found</span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant={filterType === null ? "default" : "outline"} 
                    className="cursor-pointer"
                    onClick={() => setFilterType(null)}
                  >
                    All ({result.totalIssues})
                  </Badge>
                  {(Object.entries(result.byType) as [string, number][]).map(([type, count]) => (
                    count > 0 && (
                      <Badge 
                        key={type}
                        variant={filterType === type ? "default" : "outline"}
                        className="cursor-pointer capitalize"
                        onClick={() => setFilterType(type)}
                      >
                        {type} ({count})
                      </Badge>
                    )
                  ))}
                </div>
              </div>
            </Card>

            {/* Issues List */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Issues</h3>
              <div className="space-y-3">
                {filteredIssues.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {result.totalIssues === 0 
                      ? '🎉 No issues found! Your design is consistent with the design system.'
                      : 'No issues match the selected filter.'}
                  </p>
                ) : (
                  filteredIssues.map((issue) => (
                    <Card key={issue.id} className="p-4">
                      <div className="flex items-start gap-4">
                        <Badge variant="secondary" className="capitalize shrink-0">
                          {issue.type}
                        </Badge>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{issue.nodeName}</p>
                            <code className="text-xs text-muted-foreground">{issue.nodeId}</code>
                          </div>
                          <p className="text-sm text-muted-foreground">{issue.description}</p>
                          <p className="text-sm font-medium text-primary">{issue.suggestion}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
