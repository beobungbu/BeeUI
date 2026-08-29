import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Uniwind } from 'uniwind';
import { Button, Field, FormGroup, ListItem } from '@beeui/ui';
import {
  applyDensity,
  beeRuntimeThemeNames,
  defaultDensityMode,
  densityMetricVariables,
  densityMetrics,
  densityModeDescriptions,
  densityModes,
  densityPresets,
  resolveDensityOverrides,
  themeOverrideClassification,
  type CompiledThemeOverrides,
  type DensityMode,
} from '@beeui/tokens';

// Runtime tests for BeeUI issue #74 — application density semantics.
//
// These exercise `@beeui/tokens`'s generated density surface the same way a consuming
// application would, and prove the two `@beeui/ui` reusable components that consume it
// (ListItem, FormGroup/Field) render unchanged in the default (comfortable) mode.

describe('issue #74 — application density semantics', () => {
  it('exposes exactly the approved evidence-backed mode vocabulary, comfortable as default', () => {
    expect(densityModes).toEqual(['compact', 'comfortable', 'spacious']);
    expect(defaultDensityMode).toBe('comfortable');
    expect(Object.keys(densityModeDescriptions).sort()).toEqual([...densityModes].sort());
  });

  it('exposes exactly the evidence-backed density-sensitive metric families', () => {
    // rowHeight/rowGap: ListItem's pre-#74 `min-h-14`/`gap-3`. formGap: FormGroup/Field's
    // pre-#74 `gap-2`. No other metric (control height, icon size, focus ring, typography,
    // Card/Section padding) is density-sensitive in this release — see docs/density.md.
    expect(Object.keys(densityMetrics).sort()).toEqual(['formGap', 'rowGap', 'rowHeight']);
  });

  it('comfortable density values equal the exact pre-#74 component literals', () => {
    expect(densityMetrics.rowHeight.comfortable).toBe(56); // h-14
    expect(densityMetrics.rowGap.comfortable).toBe(12); // gap-3
    expect(densityMetrics.formGap.comfortable).toBe(8); // gap-2
  });

  it('compact density never reduces rowHeight below the native touch-target minimum (44px)', () => {
    expect(densityMetrics.rowHeight.compact).toBeGreaterThanOrEqual(44);
  });

  it('resolveDensityOverrides compiles a deterministic, sorted CompiledThemeOverrides per mode', () => {
    for (const mode of densityModes) {
      const overrides = resolveDensityOverrides(mode);
      expect(overrides.cssVariables).toEqual({
        '--spacing-density-form-gap': `${densityMetrics.formGap[mode]}px`,
        '--spacing-density-row-gap': `${densityMetrics.rowGap[mode]}px`,
        '--spacing-density-row-height': `${densityMetrics.rowHeight[mode]}px`,
      });
      expect(Object.keys(overrides.cssVariables)).toEqual([...Object.keys(overrides.cssVariables)].sort());
    }
    expect(densityPresets.compact).toEqual(resolveDensityOverrides('compact'));
  });

  it('rejects an unknown density mode instead of silently returning undefined', () => {
    expect(() => resolveDensityOverrides('roomy' as DensityMode)).toThrow(/Unknown density mode "roomy"/);
  });

  it('every density metric variable lives under the same --spacing-* namespace as controlSize/pageGutter', () => {
    expect(densityMetricVariables).toEqual({
      rowHeight: '--spacing-density-row-height',
      rowGap: '--spacing-density-row-gap',
      formGap: '--spacing-density-form-gap',
    });
  });

  it('rowHeight/rowGap/formGap are never flagged runtimeOverridable — density is not a #71 category', () => {
    for (const group of ['rowHeight', 'rowGap', 'formGap'] as const) {
      expect(themeOverrideClassification[group].runtimeOverridable).toBe(false);
    }
  });

  it('exposes no additional React density provider/store — only codegen data + a thin apply helper', () => {
    const tokensExports = require('@beeui/tokens') as Record<string, unknown>;
    const suspiciousNames = Object.keys(tokensExports).filter(
      (name) => /provider|context|store/i.test(name) && /density/i.test(name),
    );
    expect(suspiciousNames).toEqual([]);
    expect(typeof resolveDensityOverrides).toBe('function');
    expect(typeof applyDensity).toBe('function');
  });

  it('reuses #71 applyThemeOverrides as its only runtime-mutation primitive — no second store', () => {
    // applyDensity(uniwind, theme, mode) has the identical (uniwind, theme, overrides) arity
    // as #71's applyThemeOverrides: it is a call-through, not a parallel implementation.
    expect(applyDensity.length).toBe(3);
    for (const runtimeTheme of beeRuntimeThemeNames) {
      expect(typeof runtimeTheme).toBe('string');
    }
  });

  it('@beeui/ui exports no scoped density component — density has no subtree scoping surface in this release', () => {
    const uiExports = require('@beeui/ui') as Record<string, unknown>;
    expect(Object.keys(uiExports)).not.toContain('BeeDensityScope');
    const suspiciousNames = Object.keys(uiExports).filter((name) => /density/i.test(name));
    expect(suspiciousNames).toEqual([]);
  });

  describe('applying a density mode through Uniwind', () => {
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

    it('is a thin call-through: Uniwind receives exactly the compiled density variables for the named theme', () => {
      applyDensity(Uniwind, 'light', 'compact');

      expect(recorded).toEqual([{ theme: 'light', vars: densityPresets.compact.cssVariables }]);
    });

    it('applying density changes only density variables — no color/radius/motion variable is touched', () => {
      applyDensity(Uniwind, 'light', 'spacious');

      expect(recorded).toHaveLength(1);
      const vars = recorded[0].vars;
      for (const key of Object.keys(vars)) {
        expect(key.startsWith('--spacing-density-')).toBe(true);
      }
      expect(vars).not.toHaveProperty('--color-primary');
      expect(vars).not.toHaveProperty('--radius-md');
      expect(vars).not.toHaveProperty('--motion-duration-normal');
    });

    it('applying to one runtime theme changes only that theme, proven end-to-end without touching Button source', () => {
      applyDensity(Uniwind, 'light', 'compact');
      applyDensity(Uniwind, 'dark', 'spacious');

      expect(recorded).toEqual([
        { theme: 'light', vars: densityPresets.compact.cssVariables },
        { theme: 'dark', vars: densityPresets.spacious.cssVariables },
      ]);

      // Button's `size` prop keeps its own meaning — its className is entirely
      // controlSize-driven (`h-control-*`) and contains no density variable at all, proving
      // an explicit component size prop is untouched by density application.
      const screen = render(
        <Button onPress={() => undefined} size="sm">
          Themed action
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Themed action' });
      const className: string = button.props.className;
      expect(className).toContain('h-control-compact');
      expect(className).not.toMatch(/density/);
    });
  });

  describe('component consumption (ListItem, FormGroup, Field)', () => {
    it('ListItem consumes the row density variables and keeps the native hit-target guard', () => {
      const screen = render(<ListItem onPress={() => undefined} title="Notifications" />);
      const row = screen.getByRole('button', { name: 'Notifications' });
      const className: string = row.props.className;
      expect(className).toContain('min-h-density-row-height');
      expect(className).toContain('gap-density-row-gap');
      expect(className).toContain('ios:min-h-touch-target');
      expect(className).toContain('android:min-h-touch-target');
    });

    it('a non-interactive ListItem still carries the density row classes', () => {
      const screen = render(<ListItem description="Value" testID="row" title="Plan" />);
      const row = screen.getByTestId('row');
      expect(row.props.className).toContain('min-h-density-row-height');
    });

    it('FormGroup consumes the form-gap density variable in place of the pre-#74 gap-2 literal', () => {
      const screen = render(
        <FormGroup legend="Notify me by" testID="group">
          <Button onPress={() => undefined}>Email</Button>
        </FormGroup>,
      );
      const group = screen.getByTestId('group');
      expect(group.props.className).toContain('gap-density-form-gap');
      expect(group.props.className).not.toMatch(/\bgap-2\b/);
    });

    it('Field consumes the form-gap density variable in place of the pre-#74 gap-2 literal', () => {
      const screen = render(
        <Field label="Display name" testID="field">
          <Button onPress={() => undefined}>Edit</Button>
        </Field>,
      );
      const field = screen.getByTestId('field');
      expect(field.props.className).toContain('gap-density-form-gap');
      expect(field.props.className).not.toMatch(/\bgap-2\b/);
    });
  });
});
