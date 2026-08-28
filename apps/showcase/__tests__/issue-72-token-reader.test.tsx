import { beeTokenReader, defineTokenReader } from '@beeui/tokens';
import { BeeThemeScope, getBeeToken, useBeeToken } from '@beeui/ui';
import * as UseBeeTokenModule from '../../../packages/ui/src/components/use-bee-token';
import { act, render } from '@testing-library/react-native';
import * as React from 'react';
import { Text } from 'react-native';
import { __resetUniwindMockVariables, Uniwind } from 'uniwind';

// Runtime tests for BeeUI issue #72 — typed runtime token readers for
// non-className consumers. These exercise `useBeeToken`/`getBeeToken` from
// `@beeui/ui` the way a consuming application would (SVG props, a chart/data
// fixture, a React Navigation-style theme mapping, imperative platform-API
// setup): no reusable @beeui/ui component source other than the reader itself
// is touched by any test in this file.

afterEach(() => {
  Uniwind.setTheme('light');
  __resetUniwindMockVariables();
});

function ColorProbe({ testID, path }: { testID: string; path: 'colors.primary' | 'colors.background' }) {
  const value = useBeeToken(path);
  return <Text testID={testID}>{value}</Text>;
}

function RadiusProbe({ testID }: { testID: string }) {
  const value = useBeeToken('radius.md');
  return <Text testID={testID}>{value}</Text>;
}

describe('issue #72 — path vocabulary is derived from canonical metadata', () => {
  it('accepts exactly colors.* | radius.* | motion.* — the same set #71 flags runtime-reactive', () => {
    const categories = new Set(beeTokenReader.paths.map((path) => path.split('.')[0]));
    expect(categories).toEqual(new Set(['colors', 'radius', 'motion']));
  });

  it('resolves a valid path to its exact Uniwind CSS-variable name', () => {
    expect(beeTokenReader.resolve('colors.primary')).toMatchObject({
      category: 'colors',
      key: 'primary',
      variable: '--color-primary',
      kind: 'color',
    });
    expect(beeTokenReader.resolve('radius.md')).toMatchObject({
      variable: '--radius-md',
      kind: 'dimension',
    });
    expect(beeTokenReader.resolve('motion.normal')).toMatchObject({
      variable: '--motion-duration-normal',
      kind: 'duration',
    });
  });

  it('rejects an unknown path — including a private #70 primitive and the build-time-only breakpoint group', () => {
    expect(() => beeTokenReader.resolve('colors.brand' as never)).toThrow(/unknown token path "colors.brand"/);
    // Private authoring primitives are never part of the public vocabulary at all.
    expect(() => beeTokenReader.resolve('colors.amber-500' as never)).toThrow(/unknown token path/);
    // breakpoint is a build-time-only Tailwind/Uniwind constant (see @beeui/tokens'
    // own JSDoc on `breakpoint`) — never a runtime-reader category.
    expect(() => beeTokenReader.resolve('breakpoint.medium' as never)).toThrow(/unknown token path/);
    expect(beeTokenReader.isValidPath('breakpoint.medium')).toBe(false);
    expect(beeTokenReader.isValidPath('colors.amber-500')).toBe(false);
  });

  it('never exposes a theme-invariant/metadata-only group (spacing, fontSize, layer, ...)', () => {
    for (const group of ['spacing', 'fontSize', 'lineHeight', 'fontWeight', 'controlSize', 'iconSize', 'avatarSize', 'contentWidth', 'pageGutter', 'elevation', 'motionEasing', 'layer', 'focusRing']) {
      expect(beeTokenReader.isValidPath(`${group}.anything`)).toBe(false);
    }
  });
});

describe('issue #72 — useBeeToken resolves correct Bee/Violet light/dark values', () => {
  it.each([
    ['light', '#f59e0b'],
    ['dark', '#fbbf24'],
    ['violet-light', '#7c3aed'],
    ['violet-dark', '#a78bfa'],
  ] as const)('resolves colors.primary for runtime theme "%s"', (runtimeTheme, expected) => {
    act(() => Uniwind.setTheme(runtimeTheme));
    const screen = render(<ColorProbe path="colors.primary" testID="probe" />);
    expect(screen.getByTestId('probe').props.children).toBe(expected);
  });

  it('returns a plain number (px) for radius, unit stripped', () => {
    const screen = render(<RadiusProbe testID="probe" />);
    expect(screen.getByTestId('probe').props.children).toBe(10);
    expect(typeof screen.getByTestId('probe').props.children).toBe('number');
  });
});

describe('issue #72 — useBeeToken re-renders when the global theme changes (no stale value)', () => {
  it('updates across a Uniwind.setTheme() call', () => {
    const screen = render(<ColorProbe path="colors.primary" testID="probe" />);
    expect(screen.getByTestId('probe').props.children).toBe('#f59e0b');

    act(() => Uniwind.setTheme('dark'));
    expect(screen.getByTestId('probe').props.children).toBe('#fbbf24');

    act(() => Uniwind.setTheme('violet-light'));
    expect(screen.getByTestId('probe').props.children).toBe('#7c3aed');
  });
});

describe('issue #72 — useBeeToken follows #68 BeeThemeScope resolution', () => {
  it('resolves the nearest scope instead of the global theme', () => {
    const screen = render(
      <BeeThemeScope appearance="dark" brand="violet">
        <ColorProbe path="colors.primary" testID="scoped" />
      </BeeThemeScope>,
    );
    // Global theme is still 'light' — the scoped read must not match it.
    expect(screen.getByTestId('scoped').props.children).toBe('#a78bfa');
  });

  it('does not leak a scoped value into a sibling subtree outside the scope', () => {
    const screen = render(
      <>
        <BeeThemeScope appearance="dark" brand="violet">
          <ColorProbe path="colors.primary" testID="scoped" />
        </BeeThemeScope>
        <ColorProbe path="colors.primary" testID="sibling" />
      </>,
    );
    expect(screen.getByTestId('scoped').props.children).toBe('#a78bfa');
    expect(screen.getByTestId('sibling').props.children).toBe('#f59e0b');
    expect(screen.getByTestId('sibling').props.children).not.toBe(screen.getByTestId('scoped').props.children);
  });

  it('keeps an explicit child scope stable across a global Uniwind.setTheme() call', () => {
    const screen = render(
      <>
        <BeeThemeScope appearance="dark" brand="violet">
          <ColorProbe path="colors.primary" testID="scoped" />
        </BeeThemeScope>
        <ColorProbe path="colors.primary" testID="global" />
      </>,
    );
    expect(screen.getByTestId('scoped').props.children).toBe('#a78bfa');

    act(() => Uniwind.setTheme('dark'));

    expect(screen.getByTestId('global').props.children).toBe('#fbbf24');
    // The explicit child scope is untouched by the global switch.
    expect(screen.getByTestId('scoped').props.children).toBe('#a78bfa');
  });
});

describe('issue #72 — getBeeToken: non-hook reads observe the global theme only', () => {
  it('reads the current global theme value as a one-shot snapshot', () => {
    expect(getBeeToken('colors.primary')).toBe('#f59e0b');
    Uniwind.setTheme('dark');
    // A stale local variable is expected to be stale — that is the documented
    // snapshot contract. Calling again returns the fresh value.
    expect(getBeeToken('colors.primary')).toBe('#fbbf24');
  });

  it('ignores an ambient BeeThemeScope — ScopedTheme only affects className/useBeeToken, never Uniwind.getCSSVariable', () => {
    let imperativeRead: string | undefined;
    function ImperativeProbe() {
      imperativeRead = getBeeToken('colors.primary');
      return null;
    }
    render(
      <BeeThemeScope appearance="dark" brand="violet">
        <ImperativeProbe />
      </BeeThemeScope>,
    );
    // The global theme is still 'light' — getBeeToken never sees the 'violet-dark' scope.
    expect(imperativeRead).toBe('#f59e0b');
  });
});

describe('issue #72 — runtime overrides (#71-style) are visible to subsequent reads, never stale', () => {
  it('a raw Uniwind.updateCSSVariables write is visible to both useBeeToken and getBeeToken', () => {
    const screen = render(<ColorProbe path="colors.primary" testID="probe" />);
    expect(screen.getByTestId('probe').props.children).toBe('#f59e0b');
    expect(getBeeToken('colors.primary')).toBe('#f59e0b');

    act(() => Uniwind.updateCSSVariables('light', { '--color-primary': '#123456' }));

    expect(screen.getByTestId('probe').props.children).toBe('#123456');
    expect(getBeeToken('colors.primary')).toBe('#123456');
  });

  it('normalizes a string-with-unit override the same way it normalizes a native numeric default', () => {
    const screen = render(<RadiusProbe testID="probe" />);
    expect(screen.getByTestId('probe').props.children).toBe(10);

    // Simulates the exact string Uniwind's real `updateCSSVariables` receives
    // from `applyThemeOverrides(defineThemeOverrides({ radius: { md: 12 } }))`.
    act(() => Uniwind.updateCSSVariables('light', { '--radius-md': '12px' }));

    expect(screen.getByTestId('probe').props.children).toBe(12);
    expect(typeof screen.getByTestId('probe').props.children).toBe('number');
  });

  it('an override applied to one runtime theme does not leak into another', () => {
    act(() => Uniwind.updateCSSVariables('dark', { '--color-primary': '#00ff00' }));
    expect(getBeeToken('colors.primary')).toBe('#f59e0b');
    act(() => Uniwind.setTheme('dark'));
    expect(getBeeToken('colors.primary')).toBe('#00ff00');
  });
});

describe('issue #72 — return types/units per category', () => {
  it('colors.* is a string, radius.*/motion.* are numbers', () => {
    expect(typeof getBeeToken('colors.primary')).toBe('string');
    expect(typeof getBeeToken('radius.md')).toBe('number');
    expect(typeof getBeeToken('motion.normal')).toBe('number');
  });

  it('motion.* normalizes to milliseconds', () => {
    expect(getBeeToken('motion.normal')).toBe(200);
  });
});

describe('issue #72 — non-className integration fixtures', () => {
  it('SVG-style props: a fill prop object reads a color token instead of a raw hex literal', () => {
    function svgIconProps() {
      return { fill: getBeeToken('colors.primary') };
    }
    expect(svgIconProps().fill).toBe('#f59e0b');
  });

  it('a minimal chart/data fixture reads its series color and corner radius from BeeUI tokens', () => {
    function chartTheme() {
      return {
        series: [{ id: 'revenue', color: getBeeToken('colors.primary') }],
        barCornerRadius: getBeeToken('radius.md'),
      };
    }
    const theme = chartTheme();
    expect(theme.series[0].color).toBe('#f59e0b');
    expect(theme.barCornerRadius).toBe(10);
  });

  it('a React Navigation-style theme object maps BeeUI semantic colors to its own theme.colors contract', () => {
    function navigationTheme() {
      return {
        dark: false,
        colors: {
          primary: getBeeToken('colors.primary'),
          background: getBeeToken('colors.background'),
        },
      };
    }
    const theme = navigationTheme();
    expect(theme.colors.primary).toBe('#f59e0b');
    expect(theme.colors.background).toBe('#ffffff');
  });

  it('an imperative platform-API call (e.g. a StatusBar-style setter) reads a resolved value outside render', () => {
    const calls: string[] = [];
    function configureStatusBar() {
      calls.push(getBeeToken('colors.background'));
    }
    configureStatusBar();
    Uniwind.setTheme('dark');
    configureStatusBar();
    expect(calls).toEqual(['#ffffff', '#0b0f14']);
  });
});

describe('issue #72 — no second theme store/provider/context', () => {
  it('use-bee-token.ts exports only the two documented functions', () => {
    expect(Object.keys(UseBeeTokenModule).sort()).toEqual(['getBeeToken', 'useBeeToken']);
  });

  it('@beeui/tokens exposes no provider/context/store name anywhere in its public surface', () => {
    const tokensExports = require('@beeui/tokens') as Record<string, unknown>;
    const suspiciousNames = Object.keys(tokensExports).filter((name) => /provider|context|store/i.test(name));
    expect(suspiciousNames).toEqual([]);
  });

  it('the generic defineTokenReader engine is pure — never touches Uniwind while merely defining a reader', () => {
    const before = Uniwind.currentTheme;
    defineTokenReader({
      demo: { kind: 'color', keys: ['a'] as const, variable: () => '--demo-a' },
    });
    expect(Uniwind.currentTheme).toBe(before);
  });
});
