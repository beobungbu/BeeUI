import * as fs from 'node:fs';
import * as path from 'node:path';
import { act, fireEvent, render } from '@testing-library/react-native';
import { BeeThemeScope, BeeUIProvider, getBeeToken, useBeeToken } from '@beeui/ui';
import * as React from 'react';
import type * as ReactTypes from 'react';
import { Text } from 'react-native';
import { __resetUniwindMockVariables, Uniwind } from 'uniwind';
import {
  beeAccessibilityBrandNames,
  beeAccessibilityRuntimeThemeNames,
  beeAccessibilityThemeRegistry,
  beeRuntimeThemeNames,
  beeThemeRegistry,
  contrastContract,
  getBeeAccessibilityThemeSelection,
  resolveBeeAccessibilityRuntimeTheme,
  semanticColorTokens,
  type BeeAccessibilityRuntimeThemeName,
  type SemanticColorToken,
} from '@beeui/tokens';

import { ThemeInspector } from '../theme-inspector';

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: ReactTypes.ReactNode }) => children,
    SafeAreaListener: ({
      children,
      onChange,
    }: {
      children?: ReactTypes.ReactNode;
      onChange: (metrics: { frame: typeof frame; insets: typeof insets }) => void;
    }) => {
      ReactActual.useEffect(() => onChange({ frame, insets }), [onChange]);
      return children;
    },
    SafeAreaView: ReactActual.forwardRef(
      (
        { children, ...props }: { children?: ReactTypes.ReactNode },
        ref: ReactTypes.ForwardedRef<ReactTypes.ComponentRef<typeof View>>,
      ) => <View ref={ref} {...props}>{children}</View>,
    ),
    useSafeAreaInsets: () => insets,
  };
});

// #77 — Bee high-contrast light/dark theme path and expanded contrast validation.
//
// This suite deliberately re-derives every relationship from the *generated* CSS
// artifact (never the canonical tokens.json directly) so it certifies what actually
// ships, the same way apps/showcase/__tests__/theme-tokens-v2.test.ts certifies #65/#66.

const themeCss = fs.readFileSync(
  path.resolve(__dirname, '../../../packages/tokens/src/theme.css'),
  'utf8',
);

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

function colorVariables(variant: string) {
  const entries = Array.from(
    variant.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6,8});/g),
    (match) => [match[1], match[2]] as const,
  );
  return { entries, values: new Map(entries) };
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
  const { values } = colorVariables(extractVariant(themeCss, theme));
  return (name: SemanticColorToken) => {
    const value = values.get(name);
    if (!value) throw new Error(`Missing ${name} in ${theme}`);
    return value;
  };
}

describe('accessibility (high-contrast) theme registry — #77', () => {
  it('is a second registry over the same defineThemeRegistry primitive, scoped to opted-in brands only', () => {
    expect(beeAccessibilityBrandNames).toEqual(['bee']);
    expect(beeAccessibilityRuntimeThemeNames).toEqual(['high-contrast-light', 'high-contrast-dark']);
    expect(beeAccessibilityThemeRegistry.brands).toEqual(['bee']);
    expect(beeAccessibilityThemeRegistry.appearances).toEqual(['light', 'dark']);
    expect(beeAccessibilityThemeRegistry.runtimeThemes).toEqual(beeAccessibilityRuntimeThemeNames);

    // Violet never opted in: it is absent, not silently mapped to a Bee value.
    expect(() => beeAccessibilityThemeRegistry.resolve('violet' as never, 'light')).toThrow(
      /unknown brand/,
    );
  });

  it('resolves brand + appearance to the same deterministic runtime-theme names the CSS/resolver ship', () => {
    const runtimeTheme: BeeAccessibilityRuntimeThemeName = resolveBeeAccessibilityRuntimeTheme(
      'bee',
      'dark',
    );
    expect(runtimeTheme).toBe('high-contrast-dark');
    expect(resolveBeeAccessibilityRuntimeTheme('bee', 'light')).toBe('high-contrast-light');
    expect(getBeeAccessibilityThemeSelection(runtimeTheme)).toEqual({ brand: 'bee', theme: 'dark' });
    expect(getBeeAccessibilityThemeSelection('unregistered-theme')).toBeUndefined();
    expect(
      beeAccessibilityThemeRegistry.selectionFor(resolveBeeAccessibilityRuntimeTheme('bee', 'light')),
    ).toEqual({ brand: 'bee', appearance: 'light' });
  });

  it('never touches the primary Bee/Violet registry or its runtime-theme names (default light/dark compatibility)', () => {
    expect(beeRuntimeThemeNames).toEqual(['light', 'dark', 'violet-light', 'violet-dark']);
    expect(beeThemeRegistry.brands).toEqual(['bee', 'violet']);
    expect(new Set([...beeRuntimeThemeNames, ...beeAccessibilityRuntimeThemeNames]).size).toBe(
      beeRuntimeThemeNames.length + beeAccessibilityRuntimeThemeNames.length,
    );
  });

  it.each(beeAccessibilityRuntimeThemeNames)(
    '%s registers a complete, unique semantic color contract in the distributable theme CSS',
    (theme) => {
      const { entries } = colorVariables(extractVariant(themeCss, theme));
      expect(entries.map(([name]) => name).sort()).toEqual([...semanticColorTokens].sort());
      expect(new Set(entries.map(([name]) => name)).size).toBe(semanticColorTokens.length);
    },
  );

  it('registers the accessibility runtime themes as self-registered custom Uniwind variants', () => {
    for (const theme of beeAccessibilityRuntimeThemeNames) {
      expect(themeCss).toContain(`@custom-variant ${theme} (&:where(.${theme}, .${theme} *));`);
      expect(themeCss.indexOf(`@custom-variant ${theme}`)).toBeLessThan(
        themeCss.indexOf(`@variant ${theme} {`),
      );
    }
  });
});

describe('contrastContract — centralized, machine-tested relationships (#77)', () => {
  it('is exported as canonical data, not ad-hoc test-only pairs', () => {
    expect(typeof contrastContract.description).toBe('string');
    expect(contrastContract.canvasTokens.length).toBeGreaterThan(0);
    expect(contrastContract.textPairs.length).toBeGreaterThan(0);
    expect(contrastContract.accessibilityMinTextRatio).toBeGreaterThanOrEqual(7);
  });

  it('covers every semantic color token as a canvas token, a required relationship, or a documented exception', () => {
    const covered = new Set<string>(contrastContract.canvasTokens);
    for (const entry of contrastContract.textPairs) {
      covered.add(entry.foreground);
      entry.backgrounds.forEach((token) => covered.add(token));
    }
    for (const entry of contrastContract.filledActionPairs) {
      covered.add(entry.foreground);
      entry.backgrounds.forEach((token) => covered.add(token));
    }
    for (const entry of contrastContract.feedbackFillPairs) {
      covered.add(entry.fill);
      covered.add(entry.foreground);
    }
    for (const entry of [
      ...contrastContract.controlBoundaryPairs,
      ...contrastContract.focusRingPairs,
      ...contrastContract.invalidBoundaryPairs,
      ...contrastContract.accessibilityOnlyPairs,
    ]) {
      covered.add(entry.boundary);
      entry.adjacent.forEach((token) => covered.add(token));
    }
    for (const entry of contrastContract.essentialIndicatorPairs) {
      covered.add(entry.indicator);
      entry.adjacent.forEach((token) => covered.add(token));
    }
    for (const entry of contrastContract.exceptions) covered.add(entry.token);

    const uncovered = semanticColorTokens.filter((token) => !covered.has(token));
    expect(uncovered).toEqual([]);
  });

  it.each([...beeRuntimeThemeNames, ...beeAccessibilityRuntimeThemeNames])(
    '%s satisfies every declared contrastContract relationship against the shipped CSS',
    (theme) => {
      const color = colorsFor(theme);

      for (const entry of contrastContract.textPairs) {
        for (const background of entry.backgrounds) {
          expect(contrastRatio(color(entry.foreground), color(background))).toBeGreaterThanOrEqual(
            entry.minRatio,
          );
        }
      }
      for (const entry of contrastContract.filledActionPairs) {
        for (const background of entry.backgrounds) {
          expect(contrastRatio(color(entry.foreground), color(background))).toBeGreaterThanOrEqual(
            entry.minRatio,
          );
        }
      }
      for (const entry of contrastContract.feedbackFillPairs) {
        expect(contrastRatio(color(entry.fill), color(entry.foreground))).toBeGreaterThanOrEqual(
          entry.minRatio,
        );
      }
      for (const entry of [
        ...contrastContract.controlBoundaryPairs,
        ...contrastContract.focusRingPairs,
        ...contrastContract.invalidBoundaryPairs,
      ]) {
        for (const adjacent of entry.adjacent) {
          expect(contrastRatio(color(entry.boundary), color(adjacent))).toBeGreaterThanOrEqual(
            entry.minRatio,
          );
        }
      }
      for (const entry of contrastContract.essentialIndicatorPairs) {
        for (const adjacent of entry.adjacent) {
          expect(contrastRatio(color(entry.indicator), color(adjacent))).toBeGreaterThanOrEqual(
            entry.minRatio,
          );
        }
      }
    },
  );

  it.each(beeAccessibilityRuntimeThemeNames)(
    '%s additionally satisfies accessibilityOnlyPairs and the AAA text minimum',
    (theme) => {
      const color = colorsFor(theme);
      for (const entry of contrastContract.accessibilityOnlyPairs) {
        for (const adjacent of entry.adjacent) {
          expect(contrastRatio(color(entry.boundary), color(adjacent))).toBeGreaterThanOrEqual(
            entry.minRatio,
          );
        }
      }
      for (const entry of contrastContract.textPairs) {
        for (const background of entry.backgrounds) {
          expect(contrastRatio(color(entry.foreground), color(background))).toBeGreaterThanOrEqual(
            contrastContract.accessibilityMinTextRatio,
          );
        }
      }
    },
  );

  it('documents (and does not silently require) the default-theme border-strong/input known limitation', () => {
    const exception = contrastContract.exceptions.find((entry) => entry.token === 'border-strong');
    expect(exception?.category).toBe('known-limitation');
    const [pair] = contrastContract.accessibilityOnlyPairs;
    const lightColor = colorsFor('light');
    expect(contrastRatio(lightColor(pair.boundary), lightColor(pair.adjacent[0]))).toBeLessThan(
      pair.minRatio,
    );
  });
});

// #77 finalization — high-contrast composes with the base-branch runtime
// primitives it rebased onto: #72's useBeeToken/getBeeToken, #68's
// BeeThemeScope, and #71's runtime overrides. None of these existed when #77
// was first authored; this suite proves the accessibility registry is not a
// dead end bolted beside them, but resolves through the exact same runtime
// machinery every other runtime theme does.
//
// Placed before the "theme inspector high-contrast toggle" block below, which
// permanently replaces `Uniwind.setTheme` with a jest.fn() spy on the shared
// mock singleton and never restores it — a real Uniwind.setTheme is required
// here to actually flip the mock's resolved CSS-variable snapshot.
describe('accessibility themes compose with #72/#68/#71 runtime primitives (#77 finalization)', () => {
  afterEach(() => {
    Uniwind.setTheme('light');
    __resetUniwindMockVariables();
  });

  function ColorProbe({ testID }: { testID: string }) {
    const value = useBeeToken('colors.primary');
    return <Text testID={testID}>{value}</Text>;
  }

  it('#72 — useBeeToken("colors.primary") resolves the real generated high-contrast value under a global Uniwind.setTheme', () => {
    const lightScreen = render(<ColorProbe testID="probe" />);
    act(() => Uniwind.setTheme('high-contrast-light'));
    expect(lightScreen.getByTestId('probe').props.children).toBe(colorsFor('high-contrast-light')('primary'));

    act(() => Uniwind.setTheme('high-contrast-dark'));
    expect(lightScreen.getByTestId('probe').props.children).toBe(colorsFor('high-contrast-dark')('primary'));
  });

  it('#72 — getBeeToken (non-hook snapshot) agrees with useBeeToken for a high-contrast runtime theme', () => {
    act(() => Uniwind.setTheme('high-contrast-dark'));
    expect(getBeeToken('colors.primary')).toBe(colorsFor('high-contrast-dark')('primary'));
  });

  it('#68 — BeeThemeScope resolves high-contrast through beeAccessibilityThemeRegistry, independent of the global theme', () => {
    const screen = render(
      <>
        <BeeThemeScope registry={beeAccessibilityThemeRegistry} brand="bee" appearance="dark">
          <ColorProbe testID="scoped" />
        </BeeThemeScope>
        <ColorProbe testID="global" />
      </>,
    );
    // Global theme is still 'light' — the scoped high-contrast read must not match it.
    expect(screen.getByTestId('scoped').props.children).toBe(colorsFor('high-contrast-dark')('primary'));
    expect(screen.getByTestId('global').props.children).toBe(colorsFor('light')('primary'));
  });

  it('#68 — BeeThemeScope accepts an already-resolved high-contrast runtime-theme name against the accessibility registry', () => {
    const screen = render(
      <BeeThemeScope registry={beeAccessibilityThemeRegistry} theme="high-contrast-light">
        <ColorProbe testID="scoped" />
      </BeeThemeScope>,
    );
    expect(screen.getByTestId('scoped').props.children).toBe(colorsFor('high-contrast-light')('primary'));
  });

  it('#71 — a runtime override applied to a high-contrast theme is visible to useBeeToken and getBeeToken, and never leaks into another theme', () => {
    const screen = render(<ColorProbe testID="probe" />);
    act(() => Uniwind.setTheme('high-contrast-light'));
    expect(screen.getByTestId('probe').props.children).toBe(colorsFor('high-contrast-light')('primary'));

    act(() => Uniwind.updateCSSVariables('high-contrast-light', { '--color-primary': '#123456' }));

    expect(screen.getByTestId('probe').props.children).toBe('#123456');
    expect(getBeeToken('colors.primary')).toBe('#123456');

    // The override on high-contrast-light must not leak into high-contrast-dark.
    act(() => Uniwind.setTheme('high-contrast-dark'));
    expect(getBeeToken('colors.primary')).toBe(colorsFor('high-contrast-dark')('primary'));
  });
});

describe('theme inspector high-contrast toggle — interactive acceptance (#77)', () => {
  // apps/showcase/__mocks__/uniwind.ts is intentionally static (useUniwind() always
  // reports 'light'); the existing convention for asserting a control's *effect*
  // (see __tests__/pattern-gallery.test.tsx "exposes a working gallery theme
  // control") is to replace Uniwind.setTheme with a spy and assert what it was
  // called with, rather than expecting the mock to reactively re-render.
  function renderInspectorWithThemeSpy() {
    const setTheme = jest.fn();
    (Uniwind as typeof Uniwind & { setTheme: typeof setTheme }).setTheme = setTheme;
    const view = render(
      <BeeUIProvider>
        <ThemeInspector onBack={() => {}} />
      </BeeUIProvider>,
    );
    return { view, setTheme };
  }

  it('defaults to the high-contrast toggle being off and enabled for the default Bee brand', () => {
    const { view } = renderInspectorWithThemeSpy();
    const toggle = view.getByRole('button', { name: 'Turn on Bee high contrast' });
    expect(toggle).toBeTruthy();
    expect(toggle).not.toBeDisabled();
    expect(view.getByText(/High contrast off/)).toBeTruthy();
  });

  it('resolves through beeAccessibilityThemeRegistry and applies the result with the ordinary Uniwind.setTheme call', () => {
    const { view, setTheme } = renderInspectorWithThemeSpy();

    fireEvent.press(view.getByRole('button', { name: 'Turn on Bee high contrast' }));

    // Exactly the runtime theme resolveBeeAccessibilityRuntimeTheme('bee', 'light')
    // produces — proving the button is wired to the real registry, not a literal.
    expect(setTheme).toHaveBeenCalledWith(resolveBeeAccessibilityRuntimeTheme('bee', 'light'));
    expect(setTheme).toHaveBeenCalledWith('high-contrast-light');
  });
});

describe('reusable components stay brand-blind: no high-contrast branching (#77)', () => {
  it('contains no if(highContrast)-style conditional anywhere in shared UI or app source', () => {
    const searchRoots = [
      path.resolve(__dirname, '../../../packages/ui/src'),
      path.resolve(__dirname, '../../../apps/showcase'),
    ];
    const pattern = /highContrast\s*(===|==|\?|&&|\|\|)|if\s*\(\s*[\w.]*[Hh]igh[Cc]ontrast/;
    const violations: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;
        if (full.includes(`${path.sep}__tests__${path.sep}`) || /\.test\.[tj]sx?$/.test(entry.name)) continue;
        const text = fs.readFileSync(full, 'utf8');
        if (pattern.test(text)) violations.push(path.relative(process.cwd(), full));
      }
    }

    for (const root of searchRoots) walk(root);
    expect(violations).toEqual([]);
  });
});
