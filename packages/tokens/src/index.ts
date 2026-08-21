export const beeThemeNames = ['light', 'dark'] as const;

export type BeeThemeName = (typeof beeThemeNames)[number];

export const semanticColorTokens = [
  'background',
  'foreground',
  'surface',
  'surface-muted',
  'surface-raised',
  'muted',
  'muted-foreground',
  'subtle-foreground',
  'primary',
  'primary-foreground',
  'primary-hover',
  'primary-pressed',
  'secondary',
  'secondary-foreground',
  'secondary-hover',
  'destructive',
  'destructive-foreground',
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'info',
  'info-foreground',
  'border',
  'border-strong',
  'input',
  'focus-ring',
  'disabled',
  'disabled-foreground',
  'overlay',
] as const;

export type SemanticColorToken = (typeof semanticColorTokens)[number];

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  full: 9999,
} as const;
