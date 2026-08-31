import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Uniwind } from 'uniwind';
import { Button } from '@beemvp/beeui-ui';
import {
  applyThemeOverrides,
  beeRuntimeThemeNames,
  defineSemanticColorOverrides,
  defineThemeOverrides,
  semanticColorTokens,
  themeOverrideClassification,
  type CompiledThemeOverrides,
} from '@beemvp/beeui-tokens';

// Runtime tests for BeeUI issue #71 — typed runtime overrides beyond colors.
//
// These exercise `@beemvp/beeui-tokens`'s generated `defineThemeOverrides` /
// `applyThemeOverrides` from the Showcase app, the same way a consuming
// application would: no reusable @beemvp/beeui-ui component source is touched by
// any test in this file.

describe('issue #71 — typed runtime overrides beyond colors', () => {
  it('accepts the exact colors/radius/motion vocabulary from canonical metadata', () => {
    const overrides = defineThemeOverrides({
      colors: { primary: '#123456', 'focus-ring': '#654321' },
      radius: { md: 12 },
      motion: { normal: 180 },
    });

    expect(overrides.cssVariables).toEqual({
      '--color-focus-ring': '#654321',
      '--color-primary': '#123456',
      '--motion-duration-normal': '180ms',
      '--radius-md': '12px',
    });
  });

  it('rejects an unknown top-level category', () => {
    expect(() =>
      // @ts-expect-error - 'spacing' is not a supported override category.
      defineThemeOverrides({ spacing: { '4': 20 } }),
    ).toThrow(/unknown override category "spacing"/);
  });

  it('rejects a build-time-only/invariant token group even though it is a real canonical token', () => {
    expect(() =>
      // @ts-expect-error - breakpoints are a build-time Tailwind/Uniwind constant, never runtime-overridable.
      defineThemeOverrides({ breakpoint: { medium: 900 } }),
    ).toThrow(/unknown override category "breakpoint"/);
  });

  it('rejects an unknown key within a known category', () => {
    expect(() =>
      // @ts-expect-error - 'notAKey' is not a radius scale name.
      defineThemeOverrides({ radius: { notAKey: 1 } }),
    ).toThrow(/unknown "radius" override key "notAKey"/);
  });

  it('rejects private authoring primitives — they are not reachable through this API at all', () => {
    // Private primitive names (e.g. amber-500-style scale steps) are never part of
    // `semanticColorTokens`, so they can only ever be rejected as an unknown key.
    expect(() =>
      defineThemeOverrides({
        // @ts-expect-error - 'amber-500' is a private authoring primitive, not a public semantic color.
        colors: { 'amber-500': '#f59e0b' },
      }),
    ).toThrow(/unknown "colors" override key "amber-500"/);
  });

  it('rejects wrong-kind values with a deterministic message naming the expected kind', () => {
    expect(() =>
      // @ts-expect-error - radius values are numbers (px), not strings.
      defineThemeOverrides({ radius: { md: '12' } }),
    ).toThrow(/"radius\.md" override value must be a number \(got string\)/);

    expect(() =>
      // @ts-expect-error - color values are strings.
      defineThemeOverrides({ colors: { primary: 123456 } }),
    ).toThrow(/"colors\.primary" override value must be a string \(got number\)/);
  });

  it('converts every supported category to its documented, deterministic unit', () => {
    expect(defineThemeOverrides({ radius: { xs: 4 } }).cssVariables['--radius-xs']).toBe('4px');
    expect(defineThemeOverrides({ motion: { fast: 80 } }).cssVariables['--motion-duration-fast']).toBe('80ms');
    expect(defineThemeOverrides({ colors: { primary: '#ff0000' } }).cssVariables['--color-primary']).toBe('#ff0000');
  });

  it('compiles to a deterministic CSS-variable order regardless of caller insertion order', () => {
    const a = defineThemeOverrides({
      colors: { primary: '#123456', 'focus-ring': '#654321' },
      radius: { md: 12 },
      motion: { normal: 180 },
    });
    const b = defineThemeOverrides({
      motion: { normal: 180 },
      radius: { md: 12 },
      colors: { 'focus-ring': '#654321', primary: '#123456' },
    });
    expect(Object.keys(a.cssVariables)).toEqual(Object.keys(b.cssVariables));
    expect(a).toEqual(b);
  });

  it('stays compatible with the existing color-only defineSemanticColorOverrides helper', () => {
    const legacy = defineSemanticColorOverrides({
      '--color-primary': '#123456',
      '--color-focus-ring': '#654321',
    });
    expect(Object.isFrozen(legacy)).toBe(true);

    const viaNewApi = defineThemeOverrides({ colors: { primary: '#123456', 'focus-ring': '#654321' } });
    // Both entry points compile colors to the identical `--color-*` representation.
    expect(viaNewApi.cssVariables).toEqual(legacy);
  });

  it('never touches Uniwind, document, or any global state while merely defining/compiling', () => {
    const before = JSON.stringify(beeRuntimeThemeNames);
    defineThemeOverrides({ radius: { md: 12 }, motion: { normal: 180 }, colors: { primary: '#123456' } });
    // Default runtime themes are untouched by a pure `defineThemeOverrides` call.
    expect(JSON.stringify(beeRuntimeThemeNames)).toBe(before);
  });

  it('the generated classification exposes exactly radius + motionDuration as runtime-overridable', () => {
    expect(themeOverrideClassification.radius.runtimeOverridable).toBe(true);
    expect(themeOverrideClassification.motionDuration.runtimeOverridable).toBe(true);
    for (const group of Object.keys(themeOverrideClassification)) {
      if (group === 'radius' || group === 'motionDuration') continue;
      expect(themeOverrideClassification[group as keyof typeof themeOverrideClassification].runtimeOverridable).toBe(
        false,
      );
    }
  });

  it('exposes no additional React theme provider/store — only the pure definer + a thin apply helper', () => {
    const tokensExports = require('@beemvp/beeui-tokens') as Record<string, unknown>;
    const suspiciousNames = Object.keys(tokensExports).filter((name) =>
      /provider|context|store/i.test(name),
    );
    expect(suspiciousNames).toEqual([]);
    expect(typeof defineThemeOverrides).toBe('function');
    expect(typeof applyThemeOverrides).toBe('function');
  });

  it('documents that #71 has no scoped/subtree override surface: only a named runtime theme is targetable', () => {
    // #68 (scoped theme selection) is not integrated on this branch, and Uniwind's
    // ScopedTheme only selects which named theme a subtree resolves to — it does not
    // scope variable *values*. `applyThemeOverrides` therefore only ever accepts one
    // named runtime theme, matching `beeRuntimeThemeNames` exactly, never a subtree.
    expect(applyThemeOverrides.length).toBe(3);
    for (const runtimeTheme of beeRuntimeThemeNames) {
      expect(typeof runtimeTheme).toBe('string');
    }
  });

  describe('applying compiled overrides through Uniwind', () => {
    let recorded: Array<{ theme: string; vars: Record<string, string | number> }>;
    let originalUpdateCSSVariables: unknown;

    beforeEach(() => {
      recorded = [];
      originalUpdateCSSVariables = (Uniwind as { updateCSSVariables?: unknown }).updateCSSVariables;
      (Uniwind as { updateCSSVariables: (theme: string, vars: Record<string, string | number>) => void }).updateCSSVariables =
        (theme, vars) => {
          recorded.push({ theme, vars });
        };
    });

    afterEach(() => {
      (Uniwind as { updateCSSVariables?: unknown }).updateCSSVariables = originalUpdateCSSVariables;
    });

    it('is a thin call-through: Uniwind receives exactly the compiled cssVariables for the named theme', () => {
      const overrides: CompiledThemeOverrides = defineThemeOverrides({
        colors: { primary: '#123456' },
        radius: { md: 12 },
      });

      applyThemeOverrides(Uniwind, 'light', overrides);

      expect(recorded).toEqual([{ theme: 'light', vars: overrides.cssVariables }]);
    });

    it('applying to one runtime theme changes only that theme — proven end-to-end without touching component source', () => {
      const colorOverride = defineThemeOverrides({ colors: { primary: '#00ff00' } });
      const nonColorOverride = defineThemeOverrides({ motion: { normal: 50 } });

      applyThemeOverrides(Uniwind, 'light', colorOverride);
      applyThemeOverrides(Uniwind, 'dark', nonColorOverride);

      expect(recorded).toEqual([
        { theme: 'light', vars: { '--color-primary': '#00ff00' } },
        { theme: 'dark', vars: { '--motion-duration-normal': '50ms' } },
      ]);
      // 'light' never received the motion override, and 'dark' never received the color one.
      expect(recorded[0].vars).not.toHaveProperty('--motion-duration-normal');
      expect(recorded[1].vars).not.toHaveProperty('--color-primary');

      // The reusable Button renders unchanged — no component source touched by #71,
      // and applying overrides does not require rendering or re-rendering it.
      const screen = render(<Button onPress={() => undefined}>Themed action</Button>);
      const button = screen.getByRole('button', { name: 'Themed action' });
      expect(button).toBeTruthy();
      const className: string = button.props.className;
      expect(className).toContain('bg-primary');
    });
  });

  it('semanticColorTokens (the colors category vocabulary) never includes a private primitive name', () => {
    for (const token of semanticColorTokens) {
      expect(token).not.toMatch(/^(amber|violet|neutral|danger|feedback)-/);
    }
  });
});
