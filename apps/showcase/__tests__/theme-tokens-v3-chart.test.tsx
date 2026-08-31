import * as fs from 'node:fs';
import * as path from 'node:path';
import { act, render } from '@testing-library/react-native';
import { BeeThemeScope, getBeeToken, useBeeToken } from '@beemvp/beeui-ui';
import * as React from 'react';
import { Text, View } from 'react-native';
import { __resetUniwindMockVariables, Uniwind } from 'uniwind';
import {
  beeAccessibilityRuntimeThemeNames,
  beeRuntimeThemeNames,
  chartColorTokens,
  chartContrastContract,
  semanticColorTokens,
  type SemanticChartToken,
} from '@beemvp/beeui-tokens';

// #78 — semantic data-visualization (chart) color tokens: a small, function-based
// vocabulary (categorical series, positive/negative delta, neutral, highlight, grid,
// axis) distinct from feedback/status semantics. Like theme-tokens-v3-high-contrast's
// suite for #77, this deliberately re-derives every relationship from the *generated*
// theme.css artifact (never tokens.json directly), so it certifies what actually ships.

const themeCss = fs.readFileSync(
  path.resolve(__dirname, '../../../packages/tokens/src/theme.css'),
  'utf8',
);

const allRuntimeThemeNames = [...beeRuntimeThemeNames, ...beeAccessibilityRuntimeThemeNames];

function extractVariant(css: string, name: string) {
  const marker = `@variant ${name} {`;
  const markerIndex = css.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing theme variant: ${name}`);

  const openIndex = css.indexOf('{', markerIndex);
  let depth = 0;
  for (let index = openIndex; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(openIndex + 1, index);
  }

  throw new Error(`Unclosed theme variant: ${name}`);
}

function chartColorVariables(variant: string) {
  const entries = Array.from(
    variant.matchAll(/--chart-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6,8});/g),
    (match) => [match[1], match[2]] as const,
  );
  return { entries, values: new Map(entries) };
}

function semanticColorVariables(variant: string) {
  const entries = Array.from(
    variant.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6,8});/g),
    (match) => [match[1], match[2]] as const,
  );
  return new Map(entries);
}

function relativeLuminance(hex: string) {
  const rgb = hex
    .slice(1, 7)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!rgb || rgb.length !== 3) throw new Error(`Unsupported color: ${hex}`);

  const linear = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(left: string, right: string) {
  const [lighter, darker] = [relativeLuminance(left), relativeLuminance(right)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

function colorsFor(theme: string) {
  const variant = extractVariant(themeCss, theme);
  const chart = chartColorVariables(variant).values;
  const colors = semanticColorVariables(variant);
  return {
    chart: (name: SemanticChartToken) => {
      const value = chart.get(name);
      if (!value) throw new Error(`Missing chart.${name} in ${theme}`);
      return value;
    },
    color: (name: string) => {
      const value = colors.get(name);
      if (!value) throw new Error(`Missing colors.${name} in ${theme}`);
      return value;
    },
  };
}

describe('chart color tokens — #78 semantic data-visualization vocabulary', () => {
  it('ships exactly the evidence-backed roles: 4 categorical series, positive/negative/neutral, highlight, grid, axis', () => {
    expect(chartColorTokens).toEqual([
      'series-1',
      'series-2',
      'series-3',
      'series-4',
      'positive',
      'negative',
      'neutral',
      'highlight',
      'grid',
      'axis',
    ]);
  });

  it('never reuses a "colors" semantic token name — the two domains stay disjoint', () => {
    const overlap = chartColorTokens.filter((name) => (semanticColorTokens as readonly string[]).includes(name));
    expect(overlap).toEqual([]);
  });

  it.each(allRuntimeThemeNames)(
    '%s registers a complete, unique chart color contract in the distributable theme CSS',
    (theme) => {
      const { entries } = chartColorVariables(extractVariant(themeCss, theme));
      expect(entries.map(([name]) => name).sort()).toEqual([...chartColorTokens].sort());
      expect(new Set(entries.map(([name]) => name)).size).toBe(chartColorTokens.length);
    },
  );
});

describe('chartContrastContract — centralized, machine-tested chart relationships (#78)', () => {
  it('is exported as canonical data, not ad-hoc test-only pairs', () => {
    expect(typeof chartContrastContract.description).toBe('string');
    expect(chartContrastContract.requiredPairs.length).toBeGreaterThan(0);
  });

  it('covers every chart color token as a required relationship or a documented exception', () => {
    const covered = new Set<string>();
    for (const entry of chartContrastContract.requiredPairs) covered.add(entry.indicator);
    for (const entry of chartContrastContract.exceptions) covered.add(entry.token);

    const uncovered = chartColorTokens.filter((token) => !covered.has(token));
    expect(uncovered).toEqual([]);
  });

  it('documents chart-grid as an intentionally decorative exception (mirrors colors.border)', () => {
    const exception = chartContrastContract.exceptions.find((entry) => entry.token === 'grid');
    expect(exception?.category).toBe('decorative');
  });

  it.each(allRuntimeThemeNames)(
    '%s satisfies every declared chartContrastContract relationship against the shipped CSS',
    (theme) => {
      const { chart, color } = colorsFor(theme);
      for (const entry of chartContrastContract.requiredPairs) {
        for (const adjacent of entry.adjacent) {
          expect(contrastRatio(chart(entry.indicator), color(adjacent))).toBeGreaterThanOrEqual(
            entry.minRatio,
          );
        }
      }
    },
  );
});

describe('critical financial/emphasis meaning is never carried by an accidental color collision (#78)', () => {
  it.each(allRuntimeThemeNames)('%s: positive, negative, and highlight are pairwise distinct', (theme) => {
    const { chart } = colorsFor(theme);
    const positive = chart('positive');
    const negative = chart('negative');
    const highlight = chart('highlight');
    expect(positive).not.toBe(negative);
    expect(positive).not.toBe(highlight);
    expect(negative).not.toBe(highlight);
  });

  it.each(allRuntimeThemeNames)('%s: the 4 categorical series values are unique within the theme', (theme) => {
    const { chart } = colorsFor(theme);
    const series = (['series-1', 'series-2', 'series-3', 'series-4'] as const).map(chart);
    expect(new Set(series).size).toBe(series.length);
  });

  it.each(allRuntimeThemeNames)('%s: neutral is distinct from positive and negative', (theme) => {
    const { chart } = colorsFor(theme);
    expect(chart('neutral')).not.toBe(chart('positive'));
    expect(chart('neutral')).not.toBe(chart('negative'));
  });
});

describe('#78 chart tokens are exposed through the #72 generic runtime readers, never a second reader/store', () => {
  afterEach(() => {
    Uniwind.setTheme('light');
    __resetUniwindMockVariables();
  });

  function ChartColorProbe({ testID, path }: { testID: string; path: `chart.${SemanticChartToken}` }) {
    const value = useBeeToken(path);
    return <Text testID={testID}>{value}</Text>;
  }

  it('useBeeToken("chart.series-1") resolves the real generated value, and changes with the active runtime theme', () => {
    const screen = render(<ChartColorProbe path="chart.series-1" testID="probe" />);
    expect(screen.getByTestId('probe').props.children).toBe(colorsFor('light').chart('series-1'));

    act(() => Uniwind.setTheme('dark'));
    expect(screen.getByTestId('probe').props.children).toBe(colorsFor('dark').chart('series-1'));
  });

  it('getBeeToken (non-hook snapshot) agrees with useBeeToken for series/positive/negative chart roles', () => {
    for (const token of ['series-1', 'positive', 'negative'] as const) {
      expect(getBeeToken(`chart.${token}`)).toBe(colorsFor('light').chart(token));
    }
  });

  it('follows #68 BeeThemeScope resolution exactly like colors.*', () => {
    const screen = render(
      <BeeThemeScope appearance="dark" brand="violet">
        <ChartColorProbe path="chart.positive" testID="scoped" />
      </BeeThemeScope>,
    );
    expect(screen.getByTestId('scoped').props.children).toBe(colorsFor('violet-dark').chart('positive'));
  });

  it('resolves through beeAccessibilityThemeRegistry for high-contrast runtime themes', () => {
    const screen = render(<ChartColorProbe path="chart.series-1" testID="probe" />);
    act(() => Uniwind.setTheme('high-contrast-light'));
    expect(screen.getByTestId('probe').props.children).toBe(
      colorsFor('high-contrast-light').chart('series-1'),
    );
  });

  it('returns a plain color string, the same normalization as colors.*', () => {
    expect(typeof getBeeToken('chart.negative')).toBe('string');
  });
});

describe('non-color reinforcement for critical positive/negative meaning (#78)', () => {
  // A minimal SVG-free finance-delta fixture: color is present (chart.positive/
  // chart.negative), but the accessible text also always carries an explicit sign
  // and a directional word, so the meaning survives with color vision removed —
  // exactly the requirement the #78 canonical prompt documents ("must not rely on
  // hue alone for critical meaning"). This is a token-contract proof, not a
  // production chart component (BeeUI ships no chart library).
  function DeltaRow({
    direction,
    label,
    percent,
    testID,
  }: {
    direction: 'up' | 'down';
    label: string;
    percent: number;
    testID: string;
  }) {
    const color = useBeeToken(direction === 'up' ? 'chart.positive' : 'chart.negative');
    const sign = direction === 'up' ? '+' : '−';
    const arrow = direction === 'up' ? '▲' : '▼';
    return (
      <View testID={testID}>
        <Text
          accessibilityLabel={`${label} ${direction === 'up' ? 'up' : 'down'} ${sign}${percent}%`}
          style={{ color }}
          testID={`${testID}-value`}
        >
          {`${arrow} ${sign}${percent}%`}
        </Text>
      </View>
    );
  }

  it('a positive and a negative delta render visually distinct colors AND distinct non-color text (sign + arrow + direction word)', () => {
    const screen = render(
      <>
        <DeltaRow direction="up" label="Revenue" percent={12} testID="revenue" />
        <DeltaRow direction="down" label="Expenses" percent={4} testID="expenses" />
      </>,
    );

    const revenueValue = screen.getByTestId('revenue-value');
    const expensesValue = screen.getByTestId('expenses-value');

    // Non-color signal: the rendered text itself encodes the sign and arrow direction,
    // independent of the `style.color` a colorblind or screen-reader user cannot rely on.
    expect(revenueValue.props.children).toContain('+12%');
    expect(expensesValue.props.children).toContain('−4%');
    expect(revenueValue.props.accessibilityLabel).toMatch(/^Revenue up \+12%$/);
    expect(expensesValue.props.accessibilityLabel).toMatch(/^Expenses down −4%$/);

    // Color signal: still present, and still distinct (positive != negative).
    expect(revenueValue.props.style.color).toBe(colorsFor('light').chart('positive'));
    expect(expensesValue.props.style.color).toBe(colorsFor('light').chart('negative'));
    expect(revenueValue.props.style.color).not.toBe(expensesValue.props.style.color);
  });
});
