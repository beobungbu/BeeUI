import * as fs from 'node:fs';
import * as path from 'node:path';
import { PixelRatio } from 'react-native';

/**
 * Reusable Dynamic Type / font-scaling contract fixtures and helpers (BeeUI 1.0 #143).
 *
 * See `docs/dynamic-type.md` for the full policy this file backs. BeeUI has no
 * real device/simulator evidence for OS-level Dynamic Type in this repository's
 * automated suite (see that doc's Evidence section), so these helpers give every
 * current and future text-bearing component test — including Tooltip/Sheet/Table/
 * Calendar/demo work that lands after #143 — one shared, deterministic way to
 * assert the same contract instead of re-deriving stress levels, source-scanning
 * conventions, or allow-lists per file.
 */

const COMPONENTS_DIR = path.resolve(__dirname, '../../../../packages/ui/src/components');

/**
 * Canonical OS-independent font-scale stress levels this contract is audited
 * against. `1` is the system default. `1.3`/`1.5` roughly track iOS "Large" /
 * early accessibility Dynamic Type steps and Android's "Large"/"Largest" font
 * scale settings. `2` is the top of BeeUI's audited range (Android's font-scale
 * ceiling on most OEM skins; a representative iOS accessibility size). BeeUI
 * does not claim coverage above `2`.
 */
export const FONT_SCALE_STRESS_LEVELS = [1, 1.3, 1.5, 2] as const;

export type FontScaleStressLevel = (typeof FONT_SCALE_STRESS_LEVELS)[number];

/**
 * Runs `fn` with `PixelRatio.getFontScale()` deterministically stubbed to
 * `scale`, restoring the previous implementation afterward.
 *
 * BeeUI components must never read this value to fork rendering/behavior (see
 * docs/dynamic-type.md — scaling is an OS/browser-owned presentation concern,
 * not an application-computed layout branch). Tests use this seam to prove
 * that props/behavior stay identical across the whole stress range, not to
 * make a component font-scale-aware.
 */
export function withFontScale<T>(scale: FontScaleStressLevel, fn: () => T): T {
  const spy = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

/**
 * A long representative string standing in for "what this content looks like
 * once the OS/browser has scaled its rendered glyph width." Components must
 * wrap (default) or, for an explicitly allow-listed control, truncate this
 * gracefully — never crash, silently drop the accessible name, or break
 * row/icon alignment.
 */
export function stressText(label: string, repeat = 6): string {
  return Array.from({ length: repeat }, () => label).join(' ');
}

/** Every `@beeui/ui` component source file, for source-level contract scans. */
export const UI_COMPONENT_SOURCE_FILES = fs
  .readdirSync(COMPONENTS_DIR)
  .filter((name) => name.endsWith('.tsx') || name.endsWith('.ts'));

export function readComponentSource(fileName: string): string {
  return fs.readFileSync(path.join(COMPONENTS_DIR, fileName), 'utf8');
}

export function readAllComponentSources(): Record<string, string> {
  return Object.fromEntries(UI_COMPONENT_SOURCE_FILES.map((name) => [name, readComponentSource(name)]));
}

/**
 * Every intentional `numberOfLines` truncation point on the current public
 * `@beeui/ui` surface, with the product rationale. Adding a new one requires
 * updating both this fixture and `docs/dynamic-type.md` — an undocumented
 * truncation point fails the dynamic-type contract test, and a documented
 * entry that no longer appears in source also fails it (keeps the doc, the
 * fixture, and the code from drifting apart).
 */
export const INTENTIONAL_TRUNCATION_POINTS: Record<string, { rationale: string }> = {
  'select.tsx': {
    rationale:
      'SelectValue renders the single persisted combobox value with numberOfLines={1}, matching native single-line select/picker trigger conventions on iOS/Android/Web. The full value remains reachable in SelectContent, and SelectTrigger itself uses a growable min-h-11 row rather than a fixed height.',
  },
  'textarea.tsx': {
    rationale:
      'Textarea forwards a caller-controlled numberOfLines (default 4) that sizes the multiline editable viewport row count, not a single-line clip. It is paired with h-auto/min-h-24 so the control still grows with typed content and larger text; callers may raise numberOfLines for more visible rows.',
  },
};

/**
 * Every text-bearing `@beeui/ui` control whose row uses a fixed (`h-*`)
 * height class instead of a growable (`min-h-*`) one, with the rationale for
 * why that control is exempt from the "rows grow with scaled text" default.
 * A source file/class pair not listed here is a contract violation: any
 * caller-text-bearing row must use `min-h-*` so it can grow instead of
 * clipping content at large font scales.
 */
export const FIXED_HEIGHT_ALLOWLIST: Record<string, { classes: string[]; rationale: string }> = {
  'avatar.tsx': {
    classes: ['h-avatar-sm', 'h-avatar-md', 'h-avatar-lg', 'h-avatar-xl', 'h-full'],
    rationale:
      'Avatar geometry (image frame / short fallback initials) is a fixed decorative badge on every platform convention BeeUI targets. Fallback initials are capped at a couple of characters by callers and are not reflowable prose.',
  },
  'button.tsx': {
    classes: ['h-control-compact', 'h-control-default', 'h-control-large', 'h-control-icon'],
    rationale:
      "Button's controlSize scale is a documented, density-invariant component-level API (docs/density.md). The ios:min-h-touch-target/android:min-h-touch-target guard keeps the tappable region at >=44px at every scale; label text wraps within the row (Button never sets numberOfLines) instead of being clipped.",
  },
  'checkbox.tsx': {
    classes: ['h-5'],
    rationale:
      'The 20x20 box is a decorative checked-state glyph indicator, not the accessible hit target (the full label row is the Pressable) and not reflowable text.',
  },
  'dropdown-menu.tsx': {
    classes: ['h-px'],
    rationale: 'Decorative separator line (DropdownMenuSeparator); carries no text.',
  },
  'input.tsx': {
    classes: ['h-control-compact', 'h-control-default', 'h-control-large'],
    rationale:
      "Input mirrors the native single-line text-field convention (UITextField/EditText) and shares Button's density-invariant controlSize scale. The ios/android touch-target guard on the sm size keeps the tappable region floor at >=44px regardless of scale; multi-line growth is Textarea's contract, not Input's.",
  },
  'progress.tsx': {
    classes: ['h-1', 'h-2', 'h-3', 'h-full'],
    rationale: 'Progress bar track/fill geometry; carries no caller text.',
  },
  'radio.tsx': {
    classes: ['h-5', 'h-2'],
    rationale: 'Decorative selected-state glyph indicators; not reflowable text.',
  },
  'separator.tsx': {
    classes: ['h-px'],
    rationale: 'Decorative 1px divider line; carries no text.',
  },
  'skeleton.tsx': {
    classes: ['h-4'],
    rationale: 'Decorative static loading placeholder; carries no real text.',
  },
  'stepper.tsx': {
    classes: ['h-8'],
    rationale: 'Decorative circular step-index glyph, not reflowable text.',
  },
  'textarea.tsx': {
    classes: ['h-auto'],
    rationale:
      'h-auto is an explicit auto/content-driven height (paired with min-h-24), not a fixed pixel height — Textarea already grows with its multiline content.',
  },
  'timeline.tsx': {
    classes: ['h-3'],
    rationale: 'Decorative status-marker dot; carries no text.',
  },
};

/**
 * Scans one component source file's literal `h-<token>` class occurrences
 * (across any quote/template-literal style, and ignoring `min-h-*`, which is
 * always growable) and returns any that are not present in
 * `FIXED_HEIGHT_ALLOWLIST` for that file. An empty result means the file has
 * no undocumented fixed-height, text-bearing-row regression.
 */
export function findUnlistedFixedHeightClasses(fileName: string, source: string): string[] {
  const matches = Array.from(source.matchAll(/(?<!min-)\bh-([a-z0-9-]+)/g)).map(
    (match) => `h-${match[1]}`,
  );
  const allowed = new Set(FIXED_HEIGHT_ALLOWLIST[fileName]?.classes ?? []);
  return Array.from(new Set(matches.filter((className) => !allowed.has(className))));
}

/** Returns true if `source` disables OS/browser font scaling anywhere. */
export function containsFontScalingOptOut(source: string): boolean {
  return /allowFontScaling\s*[:=]\s*\{?\s*false/.test(source);
}

/** Counts explicit `numberOfLines={...}` usages in a component source file. */
export function countNumberOfLinesUsages(source: string): number {
  return (source.match(/numberOfLines\s*=/g) ?? []).length;
}
