export type Viewport = { width: number; height: number };

export type FigmaSource = {
  figmaFileKey: string;
  figmaNodeIds: string[];
};

export type VisualBaseline = {
  baselineId: string;
  projectId: string;
  name: string;
  url?: string;
  figmaSource?: FigmaSource;
  viewport: Viewport;
  createdAt: string;
};

export type VisualRunStatus = 'PASS' | 'FAIL' | 'ERROR';
export type VisualRunErrorCode = 'DIMENSION_MISMATCH' | 'CAPTURE_FAILED' | 'COMPARE_FAILED' | null;

export type VisualRunResult = {
  runId: string;
  baselineId: string;
  status: VisualRunStatus;
  errorCode: VisualRunErrorCode;
  metrics: {
    mismatchPixelCount: number;
    totalPixels: number;
    mismatchPercent: number;
  };
  artifacts: {
    baseline: string;
    current: string;
    diff: string | null;
    resultJson: string;
  };
  createdAt: string;
};
