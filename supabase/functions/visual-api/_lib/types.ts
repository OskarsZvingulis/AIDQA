// Shared TypeScript types for Visual Regression API

export interface Viewport {
  width: number;
  height: number;
}

export interface Baseline {
  id: string;
  projectId: string;
  name: string;
  url: string;
  viewport: Viewport;
  createdAt: string;
  baselinePath: string;
  baselineUrl?: string; // signed URL for frontend
}

export interface Run {
  id: string;
  baselineId: string;
  projectId: string;
  createdAt: string;
  status: 'completed' | 'failed';
  mismatchPercentage: number;
  diffPixels: number;
  currentPath: string;
  diffPath: string | null;
  resultPath: string;
  aiJson?: AIInsights | null;
  // Signed URLs for frontend
  currentUrl?: string;
  diffUrl?: string | null;
  baselineUrl?: string;
}

export interface AIInsights {
  summary: string;
  severity: 'pass' | 'minor' | 'major';
  issues: AIIssue[];
  quickWins: string[];
}

export interface AIIssue {
  title: string;
  type: 'layout' | 'spacing' | 'typography' | 'color' | 'missing_element' | 'overflow' | 'alignment' | 'other';
  severity: 'minor' | 'major';
  evidence: string;
  recommendation: string;
}

export interface DiffResult {
  diffPixels: number;
  mismatchPercentage: number;
  diffPngBytes: Uint8Array | null;
}

export interface CreateBaselineRequest {
  projectId: string;
  name: string;
  url: string;
  viewport?: Viewport;
}

export interface CreateRunRequest {
  // Empty for now, runs re-use baseline URL
}

export interface APIError {
  error: string;
  code?: string;
}
