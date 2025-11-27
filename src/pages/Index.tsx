import { useState } from 'react';
import { analyzeDesign, DesignSystem, DesignNode, AnalyzeResult, defaultDesignSystem } from '@/core';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

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
          <h1 className="text-4xl font-bold tracking-tight">AI Design Check</h1>
          <p className="text-muted-foreground">
            Automatically scan design files for inconsistencies in design systems, brand standards, and accessibility.
          </p>
        </header>

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
