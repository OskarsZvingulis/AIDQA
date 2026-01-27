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
  severity: 'pass' | 'minor' | 'major' | 'critical';
  issues: AIIssue[];
  quickWins: string[];
  verdict?: string;
}

export interface AIIssue {
  title: string;
  location?: string;
  type: 'layout' | 'spacing' | 'typography' | 'color' | 'content' | 'other';
  severity: 'minor' | 'major' | 'critical';
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
