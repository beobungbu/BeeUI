import { render } from '@testing-library/react-native';
import * as React from 'react';
import {
  AlertBanner,
  Button,
  Checkbox,
  Chip,
  Input,
  ListItem,
  Pagination,
  PaginationItem,
  Select,
  SelectTrigger,
  SelectValue,
  Text,
} from '@beeui/ui';
import {
  containsFontScalingOptOut,
  countNumberOfLinesUsages,
  findUnlistedFixedHeightClasses,
  FIXED_HEIGHT_ALLOWLIST,
  FONT_SCALE_STRESS_LEVELS,
  INTENTIONAL_TRUNCATION_POINTS,
  readAllComponentSources,
  readComponentSource,
  stressText,
  UI_COMPONENT_SOURCE_FILES,
  withFontScale,
} from './helpers/dynamic-type';

// BeeUI 1.0 #143 — Dynamic Type / font-scaling contract.
//
// This suite proves the policy documented in docs/dynamic-type.md against the
// current existing `@beeui/ui` public component surface:
//   1. no component ever disables OS/browser font scaling;
//   2. every intentional single-line truncation point is deliberate and
//      documented (docs/dynamic-type.md + helpers/dynamic-type.ts stay in
//      sync with the actual source);
//   3. every fixed-height, non-`min-h-*` row is either decorative/glyph-only
//      (documented, exempt) or has been corrected to grow with content
//      (SelectTrigger, PaginationItem — this issue's fix);
//   4. the native minimum-hit-target guard is present regardless of a
//      component reading a different font-scale value;
//   5. representative text-bearing rows render their full given content
//      (wrap, don't clip) under long/stress content, independent of the
//      currently reported font scale.
//
// Evidence class: deterministic contract evidence (source-scan + rendered
// component prop assertions under `@testing-library/react-native`). This
// suite does not execute on a real iOS Simulator/Android Emulator/device, so
// it cannot prove OS-rendered glyph metrics; see docs/dynamic-type.md's
// Evidence section for the full class statement and why that gap is
// currently accepted for #143.

describe('Dynamic Type / font-scaling contract (#143)', () => {
  it('never disables OS/browser font scaling on any @beeui/ui component', () => {
    const sources = readAllComponentSources();
    const offenders = Object.entries(sources)
      .filter(([, source]) => containsFontScalingOptOut(source))
      .map(([fileName]) => fileName);

    expect(offenders).toEqual([]);
  });

  it('keeps every intentional numberOfLines truncation point documented and in sync', () => {
    const sources = readAllComponentSources();
    const actualTruncationFiles = UI_COMPONENT_SOURCE_FILES.filter(
      (fileName) => countNumberOfLinesUsages(sources[fileName]) > 0,
    ).sort();
    const documentedFiles = Object.keys(INTENTIONAL_TRUNCATION_POINTS).sort();

    expect(actualTruncationFiles).toEqual(documentedFiles);

    for (const fileName of documentedFiles) {
      expect(INTENTIONAL_TRUNCATION_POINTS[fileName].rationale.length).toBeGreaterThan(0);
    }
  });

  it('keeps every fixed-height, non-min-h row allow-listed with a rationale, and rejects unlisted ones', () => {
    const sources = readAllComponentSources();
    const violations: Record<string, string[]> = {};

    for (const fileName of UI_COMPONENT_SOURCE_FILES) {
      const unlisted = findUnlistedFixedHeightClasses(fileName, sources[fileName]);
      if (unlisted.length > 0) violations[fileName] = unlisted;
    }

    expect(violations).toEqual({});

    for (const [fileName, entry] of Object.entries(FIXED_HEIGHT_ALLOWLIST)) {
      expect(entry.classes.length).toBeGreaterThan(0);
      expect(entry.rationale.length).toBeGreaterThan(0);
      // The allow-list must not silently accumulate stale entries: every
      // allow-listed class must still actually appear in that file's source.
      expect(sources[fileName]).toBeDefined();
      for (const className of entry.classes) {
        expect(sources[fileName]).toContain(className);
      }
    }
  });

  it('fixes SelectTrigger and PaginationItem to grow instead of clipping at scale', () => {
    // Regression coverage for this issue's fix: reverting `min-h-11`/`min-h-10`
    // back to a fixed `h-11`/`h-10` fails this test AND the allow-list test
    // above (the reverted class would be neither `min-h-*` nor documented).
    const selectScreen = render(
      <Select>
        <SelectTrigger testID="select-trigger">
          <SelectValue placeholder="Choose a plan" />
        </SelectTrigger>
      </Select>,
    );
    const trigger = selectScreen.getByTestId('select-trigger');
    expect(trigger.props.className).toContain('min-h-11');
    expect(trigger.props.className).not.toMatch(/(?<!min-)h-11\b/);

    const paginationScreen = render(
      <Pagination page={1} pageCount={3}>
        <PaginationItem page={1} testID="pagination-item-1" />
      </Pagination>,
    );
    const item = paginationScreen.getByTestId('pagination-item-1');
    expect(item.props.className).toContain('min-h-10');
    expect(item.props.className).not.toMatch(/(?<!min-)h-10\b/);
  });

  it('keeps the documented single-line SelectValue truncation exact (no more, no less)', () => {
    const screen = render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Choose a plan" />
        </SelectTrigger>
      </Select>,
    );
    const value = screen.getByText('Choose a plan');
    expect(value.props.numberOfLines).toBe(1);
  });

  it('keeps the native touch-target floor guard on sm-sized controls regardless of the reported font scale', () => {
    for (const scale of FONT_SCALE_STRESS_LEVELS) {
      withFontScale(scale, () => {
        const button = render(<Button size="sm">Save</Button>).getByRole('button', { name: 'Save' });
        expect(button.props.className).toContain('ios:min-h-touch-target');
        expect(button.props.className).toContain('android:min-h-touch-target');

        const input = render(
          <Input accessibilityLabel="Code" size="sm" testID="code-input" />,
        ).getByTestId('code-input');
        expect(input.props.className).toContain('ios:min-h-touch-target');
        expect(input.props.className).toContain('android:min-h-touch-target');
      });
    }
  });

  it('keeps ListItem growable row/touch-target classes present regardless of the reported font scale', () => {
    for (const scale of FONT_SCALE_STRESS_LEVELS) {
      withFontScale(scale, () => {
        const item = render(<ListItem testID="row" title="Settings" />).getByTestId('row');
        expect(item.props.className).toContain('min-h-density-row-height');
        expect(item.props.className).toContain('ios:min-h-touch-target');
        expect(item.props.className).toContain('android:min-h-touch-target');
      });
    }
  });

  it('renders full stress-length content on representative growable rows instead of clipping it, at every audited scale', () => {
    const longLabel = stressText('accessibility', 5);

    for (const scale of FONT_SCALE_STRESS_LEVELS) {
      withFontScale(scale, () => {
        const checkboxScreen = render(
          <Checkbox checked={false} label={longLabel} onCheckedChange={() => {}} />,
        );
        expect(checkboxScreen.getByText(longLabel)).toBeTruthy();

        const chipScreen = render(<Chip>{longLabel}</Chip>);
        expect(chipScreen.getByText(longLabel)).toBeTruthy();

        const bannerScreen = render(
          <AlertBanner description={longLabel} title="Notice" />,
        );
        expect(bannerScreen.getByText(longLabel)).toBeTruthy();

        const textScreen = render(<Text>{longLabel}</Text>);
        const textNode = textScreen.getByText(longLabel);
        expect(textNode.props.numberOfLines).toBeUndefined();
      });
    }
  });

  it('never hardcodes a pixel font size for a semantic Text role (keeps Web zoom/rem scaling intact)', () => {
    const textSource = readComponentSource('text.tsx');
    // Every semantic size role must resolve through the generated theme
    // variable, never a literal px/pt value that would opt the role out of
    // Web browser zoom / OS text-size driven rem scaling.
    for (const role of ['display', 'title', 'heading', 'body', 'label', 'caption']) {
      expect(textSource).toContain(`text-[length:var(--text-${role})]`);
    }
    expect(textSource).not.toMatch(/text-\[length:\d/);
  });
});
