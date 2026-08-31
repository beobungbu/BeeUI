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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@beemvp/beeui-ui';
import {
  containsFontScalingOptOut,
  countNumberOfLinesUsages,
  findFixedHeightClassViolations,
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
// current existing `@beemvp/beeui-ui` public component surface:
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
  it('never disables OS/browser font scaling on any @beemvp/beeui-ui component', () => {
    const sources = readAllComponentSources();
    const offenders = Object.entries(sources)
      .filter(([, source]) => containsFontScalingOptOut(source))
      .map(([fileName]) => fileName);

    expect(offenders).toEqual([]);
  });

  it('keeps every intentional numberOfLines truncation point occurrence-exact, not just documented at the file level', () => {
    const sources = readAllComponentSources();
    const actualTruncationFiles = UI_COMPONENT_SOURCE_FILES.filter(
      (fileName) => countNumberOfLinesUsages(sources[fileName]) > 0,
    ).sort();
    const documentedFiles = Object.keys(INTENTIONAL_TRUNCATION_POINTS).sort();

    // Every file that uses numberOfLines is documented, and vice versa.
    expect(actualTruncationFiles).toEqual(documentedFiles);

    for (const fileName of documentedFiles) {
      const entry = INTENTIONAL_TRUNCATION_POINTS[fileName];
      expect(entry.rationale.length).toBeGreaterThan(0);
      // Occurrence-specific, not filename-specific: a *new* numberOfLines
      // usage added to a file that already has one documented would keep
      // this file in `documentedFiles` unchanged — only comparing the exact
      // count catches it. See the dedicated revert-proof test below.
      expect(countNumberOfLinesUsages(sources[fileName])).toBe(entry.occurrences);
    }
  });

  it('FAILS when a new, unregistered numberOfLines occurrence is added to an already-documented file (guard revert-proof)', () => {
    // Proves the occurrence-count guard actually catches what a
    // filename-only guard would miss: a second numberOfLines usage added to
    // select.tsx, which already has one documented entry. This does not
    // touch real source — it exercises the scanner directly against a
    // synthetic copy of the real file with one extra occurrence spliced in,
    // which is the load-bearing, revert-proof way to test a guard without
    // needing to actually break the codebase to prove the guard works.
    const realSource = readComponentSource('select.tsx');
    const injectedSource = `${realSource}\n// synthetic unreviewed second occurrence:\nconst rogueNumberOfLines = 2;\n<Text numberOfLines={rogueNumberOfLines} />;\n`;

    const documentedOccurrences = INTENTIONAL_TRUNCATION_POINTS['select.tsx'].occurrences;
    expect(countNumberOfLinesUsages(realSource)).toBe(documentedOccurrences);
    expect(countNumberOfLinesUsages(injectedSource)).not.toBe(documentedOccurrences);
    expect(countNumberOfLinesUsages(injectedSource)).toBe(documentedOccurrences + 1);
  });

  it('keeps every fixed-height, non-min-h row occurrence-exact, not just documented at the file+class level, and rejects unlisted ones', () => {
    const sources = readAllComponentSources();
    const violations: Record<string, ReturnType<typeof findFixedHeightClassViolations>> = {};

    for (const fileName of UI_COMPONENT_SOURCE_FILES) {
      const fileViolations = findFixedHeightClassViolations(fileName, sources[fileName]);
      if (fileViolations.length > 0) violations[fileName] = fileViolations;
    }

    expect(violations).toEqual({});

    for (const [fileName, entry] of Object.entries(FIXED_HEIGHT_ALLOWLIST)) {
      expect(Object.keys(entry.classes).length).toBeGreaterThan(0);
      expect(entry.rationale.length).toBeGreaterThan(0);
      // The allow-list must not silently accumulate stale entries: every
      // allow-listed class must still actually appear in that file's source,
      // and its documented occurrence count must be a positive integer.
      expect(sources[fileName]).toBeDefined();
      for (const [className, expectedCount] of Object.entries(entry.classes)) {
        expect(sources[fileName]).toContain(className);
        expect(expectedCount).toBeGreaterThan(0);
      }
    }
  });

  it('FAILS when a new, unregistered occurrence of an already-allow-listed class is added to a file (guard revert-proof)', () => {
    // Proves the occurrence-count guard catches a *new* usage of a class
    // token that is already allow-listed for that file — the exact gap a
    // presence-only ("does this class appear somewhere in this file")
    // allow-list check cannot see. Uses a synthetic copy of the real
    // checkbox.tsx source with a second, unrelated h-5 row spliced in, so
    // this proves the scanner's behavior directly without needing to modify
    // real component source to demonstrate the guard works.
    const realSource = readComponentSource('checkbox.tsx');
    const injectedSource = `${realSource}\n// synthetic unreviewed second occurrence of an already-allow-listed class:\n<View className="h-5 w-5" />;\n`;

    expect(findFixedHeightClassViolations('checkbox.tsx', realSource)).toEqual([]);

    const violations = findFixedHeightClassViolations('checkbox.tsx', injectedSource);
    expect(violations).toEqual([
      { type: 'occurrence-count-mismatch', className: 'h-5', expected: 1, actual: 2 },
    ]);
  });

  it('FAILS when a brand-new, never-allow-listed fixed-height class is added to a file (guard revert-proof)', () => {
    const realSource = readComponentSource('separator.tsx');
    const injectedSource = `${realSource}\n// synthetic unreviewed brand-new fixed-height class:\nconst rogue = 'h-99';\n`;

    const violations = findFixedHeightClassViolations('separator.tsx', injectedSource);
    expect(violations).toContainEqual({ type: 'unlisted', className: 'h-99', actual: 1 });
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

  it('keeps Table row and sort-trigger touch-target classes present regardless of the reported font scale (#167)', () => {
    for (const scale of FONT_SCALE_STRESS_LEVELS) {
      withFontScale(scale, () => {
        const screen = render(
          <Table>
            <TableHeader>
              <TableRow testID="header-row">
                <TableHead onSortChange={() => {}} sortDirection="none">
                  Name
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow testID="body-row">
                <TableCell>Ada</TableCell>
              </TableRow>
            </TableBody>
          </Table>,
        );

        const trigger = screen.getByRole('button', { name: 'Name, not sorted' });
        expect(trigger.props.className).toContain('ios:min-h-touch-target');
        expect(trigger.props.className).toContain('android:min-h-touch-target');

        for (const testId of ['header-row', 'body-row']) {
          const row = screen.getByTestId(testId);
          expect(row.props.className).toContain('min-h-density-row-height');
          expect(row.props.className).toContain('ios:min-h-touch-target');
          expect(row.props.className).toContain('android:min-h-touch-target');
        }
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

        const tableScreen = render(
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>{longLabel}</TableCell>
              </TableRow>
            </TableBody>
          </Table>,
        );
        const tableCellText = tableScreen.getByText(longLabel);
        expect(tableCellText).toBeTruthy();
        expect(tableCellText.props.numberOfLines).toBeUndefined();

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
