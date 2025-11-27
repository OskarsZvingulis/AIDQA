import { DesignSystem } from './types';

export const defaultDesignSystem: DesignSystem = {
  project: {
    name: 'NorthStar Dashboard',
    platform: 'web',
    grid: {
      columns: 12,
      gutter: 24,
      containerWidth: 1200,
    },
  },
  colors: {
    brand: ['#000000', '#FFFFFF', '#0A84FF', '#FF3B30'],
    neutral: ['#111111', '#333333', '#777777', '#BBBBBB', '#F5F5F5'],
  },
  typography: {
    H1: { fontSize: 32, lineHeight: 40, fontWeight: 700 },
    H2: { fontSize: 24, lineHeight: 32, fontWeight: 600 },
    Body: { fontSize: 16, lineHeight: 24, fontWeight: 400 },
    Caption: { fontSize: 12, lineHeight: 16, fontWeight: 400 },
  },
  spacingScale: [4, 8, 12, 16, 20, 24, 32],
  radiusScale: [4, 8, 16],
  components: [
    'Button/Primary',
    'Button/Secondary',
    'Input/Default',
    'Input/Error',
    'Card/Standard',
  ],
  states: {
    primaryHover: '#0C6DFF',
    primaryPressed: '#064CAD',
    disabledOpacity: 0.4,
  },
  accessibility: {
    minContrastRatio: 4.5,
    minBodyFontSize: 14,
  },
  icons: {
    sizes: [16, 20, 24],
  },
};
