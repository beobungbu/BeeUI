export const visualScenarios = [
  { id: 'foundation', label: 'Foundation' },
  { id: 'forms', label: 'Forms' },
  { id: 'navigation-data', label: 'Navigation and data' },
  { id: 'dialog-open', label: 'Dialog open' },
  { id: 'alert-dialog-open', label: 'AlertDialog open' },
  { id: 'popover-open', label: 'Popover open' },
  { id: 'dropdown-menu-open', label: 'DropdownMenu open' },
  // #77 finalization — one representative Pattern Gallery screen (a compact
  // reconstruction of apps/showcase/patterns/auth's sign-in screen, built the
  // same way every other scenario here is: from @beemvp/beeui-ui primitives only, no
  // cross-app import) so the accessibility axis is proven against a realistic
  // composed screen, not just isolated components.
  { id: 'pattern-sign-in', label: 'Pattern: sign in' },
  // #78 — semantic data-visualization (chart) color tokens. A lightweight,
  // dependency-free SVG fixture (no chart library) proving the `chart.*` token
  // contract: a 4-series categorical bar chart with gridlines/axis and a
  // highlighted bar, plus a positive/negative/neutral finance-delta list with
  // non-color reinforcement (sign + arrow + label, never color alone).
  { id: 'dataviz', label: 'Data visualization' },
] as const;

export type VisualScenarioId = (typeof visualScenarios)[number]['id'];

// #77 finalization — Bee's high-contrast light/dark accessibility appearance
// (beeAccessibilityRuntimeThemeNames) joins the primary light/dark baseline set.
export const visualThemes = ['light', 'dark', 'high-contrast-light', 'high-contrast-dark'] as const;
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
  return (visualThemes as readonly string[]).includes(value ?? '');
}

/**
 * The underlying light/dark appearance a visual theme renders with, for
 * Playwright's `colorScheme` browser-context emulation (which only ever
 * understands the OS-level light/dark signal, not BeeUI's brand/accessibility
 * axis). `high-contrast-light`/`high-contrast-dark` map to the appearance half
 * of their name — the accessibility axis itself is selected entirely through
 * the app's own `?theme=` query param and `Uniwind.setTheme`, exactly like
 * `violet-light`/`violet-dark` would if this harness covered brand variants.
 */
export function colorSchemeForVisualTheme(theme: VisualTheme): 'light' | 'dark' {
  return theme === 'dark' || theme === 'high-contrast-dark' ? 'dark' : 'light';
}

export function screenshotName(
  scenario: VisualScenarioId,
  theme: VisualTheme,
  viewport: VisualViewportName,
) {
  return `${scenario}--${theme}--${viewport}.png`;
}
