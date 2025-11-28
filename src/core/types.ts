export type ColorRGB = { r: number; g: number; b: number };

export type Paint = {
  type: 'SOLID';
  color: ColorRGB;
};

export type TypographyStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
};

export type DesignNode = {
  id: string;
  name: string;
  type: string;
  children?: DesignNode[];
  fills?: Paint[];
  spacing?: number | null;
  textStyle?: string | null;
  componentName?: string | null;
  // Optional foreground/background colors for contrast checks:
  foregroundColor?: ColorRGB | null;
  backgroundColor?: ColorRGB | null;
  // New properties to support richer checks
  fontSize?: number | null;
  borderRadius?: number | null;
  iconSize?: number | null;
};

export type DesignSystem = {
  project: {
    name: string;
    platform: 'web' | 'ios' | 'android' | string;
    grid: {
      columns: number;
      gutter: number;
      containerWidth: number;
    };
  };
  colors: {
    brand: string[];
    neutral: string[];
  };
  typography: Record<string, TypographyStyle>;
  spacingScale: number[];
  radiusScale: number[];
  components: string[];
  states: {
    primaryHover: string;
    primaryPressed: string;
    disabledOpacity: number;
  };
  accessibility: {
    minContrastRatio: number;
    minBodyFontSize: number;
  };
  icons: {
    sizes: number[];
  };
};

export type IssueType =
  | 'spacing'
  | 'color'
  | 'text'
  | 'component'
  | 'accessibility'
  | 'radius';

export type Issue = {
  id: string;
  type: IssueType;
  nodeId: string;
  nodeName: string;
  description: string;
  suggestion: string;
};

export type AnalyzeResult = {
  totalIssues: number;
  byType: Record<IssueType, number>;
  issues: Issue[];
};
