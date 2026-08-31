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

/** Every `@beemvp/beeui-ui` component source file, for source-level contract scans. */
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
 * `@beemvp/beeui-ui` surface, with the product rationale. `occurrences` is the exact
 * count of `numberOfLines=` matches (`countNumberOfLinesUsages`) this file is
 * reviewed and expected to contain right now.
 *
 * This is deliberately occurrence-specific, not just filename-specific:
 * adding a *new* `numberOfLines` usage to a file that already has one listed
 * here bumps that file's actual count without changing which files are
 * listed, so a filename-only guard would silently pass it. Requiring the
 * count to match exactly means a new, unreviewed occurrence in an
 * already-listed file fails this contract until this fixture (and
 * `docs/dynamic-type.md`) are updated to explicitly account for it — see
 * `keeps every intentional numberOfLines truncation point occurrence-exact,
 * not just documented at the file level` in dynamic-type-contract.test.tsx
 * for the regression proof.
 */
export const INTENTIONAL_TRUNCATION_POINTS: Record<
  string,
  { rationale: string; occurrences: number }
> = {
  'select.tsx': {
    occurrences: 1,
    rationale:
      'SelectValue renders the single persisted combobox value with numberOfLines={1}, matching native single-line select/picker trigger conventions on iOS/Android/Web. The full value remains reachable in SelectContent, and SelectTrigger itself uses a growable min-h-11 row rather than a fixed height.',
  },
  'textarea.tsx': {
    occurrences: 2,
    rationale:
      'Textarea forwards a caller-controlled numberOfLines (default 4) that sizes the multiline editable viewport row count, not a single-line clip. It is paired with h-auto/min-h-24 so the control still grows with typed content and larger text; callers may raise numberOfLines for more visible rows. The count of 2 covers the destructured default (`numberOfLines = 4`) and the single forwarded JSX prop usage — both textual matches of the same one caller-facing prop, not two different truncation behaviors.',
  },
};

/**
 * Every text-bearing `@beemvp/beeui-ui` control whose row uses a fixed (`h-*`)
 * height class instead of a growable (`min-h-*`) one, with the rationale for
 * why that control is exempt from the "rows grow with scaled text" default.
 *
 * `classes` maps each allow-listed class token to the exact number of times
 * it is reviewed and expected to occur in that file right now
 * (`findFixedHeightClassViolations` counts real occurrences, not just
 * presence). This is deliberately occurrence-specific, not just
 * file+token-specific: a *new* occurrence of an already-allow-listed class in
 * the same file (e.g. a second `h-5` row added to `checkbox.tsx` for an
 * unrelated element) would keep the file/class pair "known" under a
 * presence-only check and silently bypass review. Requiring the count to
 * match exactly means that new, unreviewed occurrence fails this contract
 * until this fixture (and `docs/dynamic-type.md`) are updated to explicitly
 * account for it — see `keeps every fixed-height class occurrence-exact, not
 * just documented at the file level` in dynamic-type-contract.test.tsx for
 * the regression proof.
 */
export const FIXED_HEIGHT_ALLOWLIST: Record<
  string,
  { classes: Record<string, number>; rationale: string }
> = {
  'avatar.tsx': {
    classes: { 'h-avatar-sm': 1, 'h-avatar-md': 1, 'h-avatar-lg': 1, 'h-avatar-xl': 1, 'h-full': 1 },
    rationale:
      'Avatar geometry (image frame / short fallback initials) is a fixed decorative badge on every platform convention BeeUI targets. Fallback initials are capped at a couple of characters by callers and are not reflowable prose.',
  },
  'button.tsx': {
    classes: {
      'h-control-compact': 1,
      'h-control-default': 1,
      'h-control-large': 1,
      'h-control-icon': 1,
    },
    rationale:
      "Button's controlSize scale is a documented, density-invariant component-level API (docs/density.md). The ios:min-h-touch-target/android:min-h-touch-target guard keeps the tappable region at >=44px at every scale; label text wraps within the row (Button never sets numberOfLines) instead of being clipped.",
  },
  'checkbox.tsx': {
    classes: { 'h-5': 1 },
    rationale:
      'The 20x20 box is a decorative checked-state glyph indicator, not the accessible hit target (the full label row is the Pressable) and not reflowable text.',
  },
  'dropdown-menu.tsx': {
    classes: { 'h-px': 1 },
    rationale: 'Decorative separator line (DropdownMenuSeparator); carries no text.',
  },
  'input.tsx': {
    classes: { 'h-control-compact': 1, 'h-control-default': 1, 'h-control-large': 1 },
    rationale:
      "Input mirrors the native single-line text-field convention (UITextField/EditText) and shares Button's density-invariant controlSize scale. The ios/android touch-target guard on the sm size keeps the tappable region floor at >=44px regardless of scale; multi-line growth is Textarea's contract, not Input's.",
  },
  'progress.tsx': {
    classes: { 'h-1': 1, 'h-2': 1, 'h-3': 1, 'h-full': 1 },
    rationale: 'Progress bar track/fill geometry; carries no caller text.',
  },
  'radio.tsx': {
    classes: { 'h-5': 1, 'h-2': 1 },
    rationale: 'Decorative selected-state glyph indicators; not reflowable text.',
  },
  'separator.tsx': {
    classes: { 'h-px': 1 },
    rationale: 'Decorative 1px divider line; carries no text.',
  },
  'sheet.native.tsx': {
    classes: { 'h-1': 1 },
    rationale:
      "#158's native `SheetHandle` re-implementation (rendered through gorhom's own `handleComponent` slot, see the file's module docblock) reuses the exact same decorative pill-shaped handle as sheet.tsx's, including its \"h-1.5\" class (recorded as \"h-1\" by this scanner's non-decimal-aware boundary, same as sheet.tsx/sheet.web.tsx). Same rationale: a decorative fixed-size marker with no text, hidden from assistive tech.",
  },
  'sheet.tsx': {
    classes: { 'h-1': 1 },
    rationale:
      "SheetHandle's small pill-shaped drag-handle affordance uses the decimal class \"h-1.5\", which this scanner's non-decimal-aware h-<token> boundary records as \"h-1\" (stops before the literal dot). Like checkbox/radio's glyph indicators, it is a decorative fixed-size marker with no text, hidden from assistive tech (accessibilityElementsHidden/aria-hidden).",
  },
  'sheet.web.tsx': {
    classes: { 'h-1': 1 },
    rationale:
      "#159's Web `SheetHandle` re-implementation reuses the exact same decorative pill-shaped handle as sheet.tsx's, including its \"h-1.5\" class (recorded as \"h-1\" by this scanner's non-decimal-aware boundary, same as sheet.tsx). Same rationale: a decorative fixed-size marker with no text, hidden from assistive tech.",
  },
  'skeleton.tsx': {
    classes: { 'h-4': 1 },
    rationale: 'Decorative static loading placeholder; carries no real text.',
  },
  'stepper.tsx': {
    classes: { 'h-8': 1 },
    rationale: 'Decorative circular step-index glyph, not reflowable text.',
  },
  'textarea.tsx': {
    classes: { 'h-auto': 1 },
    rationale:
      'h-auto is an explicit auto/content-driven height (paired with min-h-24), not a fixed pixel height — Textarea already grows with its multiline content.',
  },
  'timeline.tsx': {
    classes: { 'h-3': 1 },
    rationale: 'Decorative status-marker dot; carries no text.',
  },
};

/** One occurrence-level violation of the fixed-height contract for a single file. */
export type FixedHeightViolation =
  | { type: 'unlisted'; className: string; actual: number }
  | { type: 'occurrence-count-mismatch'; className: string; expected: number; actual: number };

/**
 * Scans one component source file's literal `h-<token>` class occurrences
 * (across any quote/template-literal style, and ignoring `min-h-*`, which is
 * always growable) and returns every occurrence-level violation against
 * `FIXED_HEIGHT_ALLOWLIST` for that file:
 *
 * - a class token not listed at all for this file (`'unlisted'`);
 * - a listed class token whose actual occurrence count in source does not
 *   match the reviewed, documented count (`'occurrence-count-mismatch'`) —
 *   this is what catches a *new*, unreviewed occurrence of an
 *   already-allow-listed class, not just a brand-new class name.
 *
 * An empty result means the file has no undocumented fixed-height,
 * text-bearing-row regression — every occurrence of every fixed-height class
 * in this file is exactly the reviewed, expected one.
 */
export function findFixedHeightClassViolations(
  fileName: string,
  source: string,
): FixedHeightViolation[] {
  const matches = Array.from(source.matchAll(/(?<!min-)\bh-([a-z0-9-]+)/g)).map(
    (match) => `h-${match[1]}`,
  );
  const actualCounts = new Map<string, number>();
  for (const className of matches) {
    actualCounts.set(className, (actualCounts.get(className) ?? 0) + 1);
  }

  const allowed = FIXED_HEIGHT_ALLOWLIST[fileName]?.classes ?? {};
  const violations: FixedHeightViolation[] = [];

  for (const [className, actual] of actualCounts) {
    const expected = allowed[className];
    if (expected === undefined) {
      violations.push({ type: 'unlisted', className, actual });
    } else if (expected !== actual) {
      violations.push({ type: 'occurrence-count-mismatch', className, expected, actual });
    }
  }

  return violations;
}

/** Returns true if `source` disables OS/browser font scaling anywhere. */
export function containsFontScalingOptOut(source: string): boolean {
  return /allowFontScaling\s*[:=]\s*\{?\s*false/.test(source);
}

/** Counts explicit `numberOfLines={...}` usages in a component source file. */
export function countNumberOfLinesUsages(source: string): number {
  return (source.match(/numberOfLines\s*=/g) ?? []).length;
}
