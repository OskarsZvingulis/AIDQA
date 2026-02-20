// Shared TypeScript types for Visual Regression API

export interface Viewport {
  width: number;
  height: number;
}

export interface IgnoreRegion {
  x: number;
  y: number;
  width: number;
  height: number;
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
  aiStatus?: 'skipped' | 'pending' | 'completed' | 'failed';
  aiError?: string | null;
  cssDiffJson?: any | null;
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
  isPassed?: boolean;
}

export interface DesignBaseline {
  id: string;
  projectId: string;
  name: string;
  sourceType: 'url' | 'figma' | 'upload';
  snapshotPath: string;
  viewport: Viewport;
  approved: boolean;
  approvedAt: string | null;
  createdAt: string;
}

export interface Monitor {
  id: string;
  projectId: string;
  baselineId: string;
  targetUrl: string;
  cadence: string;
  enabled: boolean;
  createdAt: string;
}

export interface CreateDesignBaselineRequest {
  projectId: string;
  name: string;
  sourceType: 'url' | 'figma' | 'upload';
  viewport?: Viewport;
  // For URL/Figma sources
  sourceUrl?: string;
  figmaFileKey?: string;
  figmaNodeId?: string;
  // For upload source
  snapshotData?: Uint8Array;
}

export interface CreateMonitorRequest {
  projectId: string;
  baselineId: string;
  targetUrl: string;
  cadence?: string;
}

export interface APIError {
  error: string;
  code?: string;
}
