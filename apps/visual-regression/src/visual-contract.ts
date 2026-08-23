export const visualScenarios = [
  { id: 'foundation', label: 'Foundation' },
  { id: 'forms', label: 'Forms' },
  { id: 'navigation-data', label: 'Navigation and data' },
  { id: 'dialog-open', label: 'Dialog open' },
  { id: 'alert-dialog-open', label: 'AlertDialog open' },
  { id: 'popover-open', label: 'Popover open' },
  { id: 'dropdown-menu-open', label: 'DropdownMenu open' },
] as const;

export type VisualScenarioId = (typeof visualScenarios)[number]['id'];

export const visualThemes = ['light', 'dark'] as const;
export type VisualTheme = (typeof visualThemes)[number];

export const visualViewports = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
} as const;

export type VisualViewportName = keyof typeof visualViewports;

export type VisualProjectMetadata = {
  visualTheme: VisualTheme;
  visualViewport: VisualViewportName;
};

export function isVisualScenarioId(value: string | null): value is VisualScenarioId {
  return visualScenarios.some((scenario) => scenario.id === value);
}

export function isVisualTheme(value: string | null): value is VisualTheme {
  return value === 'light' || value === 'dark';
}

export function screenshotName(
  scenario: VisualScenarioId,
  theme: VisualTheme,
  viewport: VisualViewportName,
) {
  return `${scenario}--${theme}--${viewport}.png`;
}
