import { render } from '@testing-library/react-native';
import * as React from 'react';
import {
  beeBrandNames,
  beeRuntimeThemeByBrand,
  beeRuntimeThemeNames,
  beeThemeNames,
  beeThemeRegistry,
  defineThemeRegistry,
  getBeeThemeSelection,
  isBeeDarkRuntimeTheme,
  resolveBeeRuntimeTheme,
} from '@beeui/tokens';
import { Button } from '@beeui/ui';

// A third brand defined the way an external consumer would: from the public
// @beeui/tokens API, without editing any BeeUI package source.
const acmeRegistry = defineThemeRegistry({
  bee: { light: 'light', dark: 'dark' },
  violet: { light: 'violet-light', dark: 'violet-dark' },
  acme: { light: 'acme-light', dark: 'acme-dark' },
});

describe('issue #67 — extensible theme registry', () => {
  it('infers the brand union from the definition keys', () => {
    expect(acmeRegistry.brands).toEqual(['bee', 'violet', 'acme']);
    expect(acmeRegistry.appearances).toEqual(['light', 'dark']);
  });

  it('infers the runtime-theme union from the mapped values', () => {
    expect(acmeRegistry.runtimeThemes).toEqual([
      'light',
      'dark',
      'violet-light',
      'violet-dark',
      'acme-light',
      'acme-dark',
    ]);
  });

  it('resolves a third brand + appearance to its runtime theme without editing BeeUI source', () => {
    expect(acmeRegistry.resolve('acme', 'dark')).toBe('acme-dark');
    expect(acmeRegistry.resolve('acme', 'light')).toBe('acme-light');
  });

  it('accepts a registry whose every brand defines the complete appearance set', () => {
    expect(() =>
      defineThemeRegistry({
        one: { light: 'one-light', dark: 'one-dark' },
        two: { light: 'two-light', dark: 'two-dark' },
      }),
    ).not.toThrow();
  });

  it('rejects a registry where a brand is missing a required appearance', () => {
    expect(() =>
      defineThemeRegistry({
        bee: { light: 'light', dark: 'dark' },
        // @ts-expect-error - intentionally incomplete brand for the validation test.
        broken: { light: 'broken-light' },
      }),
    ).toThrow(/must define exactly the appearances/);
  });

  it('rejects a registry with a duplicate runtime-theme name (ambiguous reverse lookup)', () => {
    expect(() =>
      defineThemeRegistry({
        bee: { light: 'shared', dark: 'dark' },
        clash: { light: 'shared', dark: 'clash-dark' },
      }),
    ).toThrow(/mapped by more than one brand\/appearance/);
  });

  it('round-trips resolve <-> selectionFor deterministically for every brand and appearance', () => {
    for (const brand of acmeRegistry.brands) {
      for (const appearance of acmeRegistry.appearances) {
        const runtimeTheme = acmeRegistry.resolve(brand, appearance);
        expect(acmeRegistry.selectionFor(runtimeTheme)).toEqual({ brand, appearance });
      }
    }
    expect(acmeRegistry.selectionFor('does-not-exist')).toBeUndefined();
  });

  it('keeps the default Bee/Violet registry mappings exactly unchanged', () => {
    expect(beeThemeRegistry.brands).toEqual([...beeBrandNames]);
    expect(beeThemeRegistry.appearances).toEqual([...beeThemeNames]);
    expect(beeThemeRegistry.runtimeThemes).toEqual([...beeRuntimeThemeNames]);
    expect(beeThemeRegistry.map).toEqual(beeRuntimeThemeByBrand);
    expect(beeThemeRegistry.resolve('bee', 'light')).toBe('light');
    expect(beeThemeRegistry.resolve('violet', 'dark')).toBe('violet-dark');
  });

  it('produces results identical to the compatibility helpers for the default registry', () => {
    for (const brand of beeBrandNames) {
      for (const appearance of beeThemeNames) {
        const viaRegistry = beeThemeRegistry.resolve(brand, appearance);
        expect(viaRegistry).toBe(resolveBeeRuntimeTheme(brand, appearance));

        const selection = beeThemeRegistry.selectionFor(viaRegistry);
        expect(selection).toEqual({ brand, appearance });
        // The legacy helper keeps its `theme` key for backwards compatibility.
        expect(getBeeThemeSelection(viaRegistry)).toEqual({ brand, theme: appearance });
        expect(beeThemeRegistry.isAppearance(viaRegistry, 'dark')).toBe(
          isBeeDarkRuntimeTheme(viaRegistry),
        );
      }
    }
  });

  it('holds no mutable registry state', () => {
    expect(Object.isFrozen(beeThemeRegistry)).toBe(true);
    expect(Object.isFrozen(beeThemeRegistry.brands)).toBe(true);
    expect(Object.isFrozen(beeThemeRegistry.appearances)).toBe(true);
    expect(Object.isFrozen(beeThemeRegistry.runtimeThemes)).toBe(true);
    // The mapping itself is a deep-frozen snapshot: the top-level map and each
    // brand row are frozen, so no consumer can desynchronize resolve from
    // selectionFor by mutating exposed data.
    expect(Object.isFrozen(beeThemeRegistry.map)).toBe(true);
    expect(Object.isFrozen(beeThemeRegistry.map.bee)).toBe(true);
    expect(() => {
      (beeThemeRegistry.brands as string[]).push('mutated');
    }).toThrow(TypeError);
    // Two independent constructions never share or accumulate state.
    const a = defineThemeRegistry({ x: { light: 'x-light', dark: 'x-dark' } });
    const b = defineThemeRegistry({ y: { light: 'y-light', dark: 'y-dark' } });
    expect(a.brands).toEqual(['x']);
    expect(b.brands).toEqual(['y']);
  });

  it('keeps resolve and selectionFor in sync even when a caller tries to mutate the map', () => {
    // Mutating the exposed (deep-frozen) map is rejected either way — a TypeError
    // in strict mode, a silent no-op in sloppy mode — and never changes resolve
    // output, because resolve and selectionFor read the same frozen snapshot.
    try {
      (beeThemeRegistry.map as { bee: { light: string } }).bee.light = 'hacked';
    } catch {
      // A strict-mode TypeError on the frozen property is expected and fine.
    }
    expect(beeThemeRegistry.map.bee.light).toBe('light');
    expect(beeThemeRegistry.resolve('bee', 'light')).toBe('light');
    expect(beeThemeRegistry.selectionFor('light')).toEqual({ brand: 'bee', appearance: 'light' });
    expect(beeThemeRegistry.selectionFor('hacked')).toBeUndefined();
  });

  it('snapshots its input: mutating the caller object afterward does not affect the registry', () => {
    const definition = {
      bee: { light: 'light', dark: 'dark' },
    };
    const registry = defineThemeRegistry(definition);
    // The caller's own object is untouched (not frozen) and stays mutable.
    expect(Object.isFrozen(definition)).toBe(false);
    definition.bee.light = 'mutated-after-construction';
    // The registry resolved from its internal frozen snapshot, so it is immune.
    expect(registry.resolve('bee', 'light')).toBe('light');
    expect(registry.map.bee.light).toBe('light');
    expect(registry.selectionFor('light')).toEqual({ brand: 'bee', appearance: 'light' });
  });

  it('exposes the public registry API through the package barrel', () => {
    expect(typeof defineThemeRegistry).toBe('function');
    expect(typeof beeThemeRegistry.resolve).toBe('function');
    expect(typeof beeThemeRegistry.selectionFor).toBe('function');
    expect(typeof beeThemeRegistry.isAppearance).toBe('function');
  });

  it('keeps reusable components brand-blind end-to-end under a third brand runtime theme', () => {
    // The application resolves the Uniwind runtime-theme name from the registry;
    // the reusable Button takes no brand input and renders identically. Applying
    // the theme stays an explicit Uniwind.setTheme call the app owns — the
    // registry never touches runtime state.
    const runtimeTheme = acmeRegistry.resolve('acme', 'dark');
    expect(runtimeTheme).toBe('acme-dark');

    const screen = render(<Button onPress={() => undefined}>Acme action</Button>);
    const button = screen.getByRole('button', { name: 'Acme action' });
    expect(button).toBeTruthy();
    // The Button styles through semantic tokens only; no brand or runtime-theme
    // name leaks into its className contract.
    const className: string = button.props.className;
    expect(typeof className).toBe('string');
    expect(className).toContain('bg-primary');
    expect(className).not.toContain('acme');
    expect(className).not.toContain('violet');
  });
});
