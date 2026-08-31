import { defineThemeRegistry } from '@beemvp/beeui-tokens';

describe('issue #67 — registry prototype-key hardening', () => {
  it('treats prototype-looking consumer keys as ordinary frozen mapping data', () => {
    const definition = JSON.parse(`{
      "__proto__": { "light": "proto-light", "dark": "proto-dark" },
      "constructor": { "light": "ctor-light", "dark": "ctor-dark" }
    }`) as Record<string, Record<string, string>>;

    const registry = defineThemeRegistry(definition);

    expect(registry.brands).toEqual(['__proto__', 'constructor']);
    expect(Object.getPrototypeOf(registry.map)).toBeNull();
    expect(Object.getPrototypeOf(registry.map['__proto__'])).toBeNull();
    expect(Object.hasOwn(registry.map, '__proto__')).toBe(true);
    expect(Object.hasOwn(registry.map, 'constructor')).toBe(true);
    expect(registry.resolve('__proto__', 'dark')).toBe('proto-dark');
    expect(registry.resolve('constructor', 'light')).toBe('ctor-light');
    expect(registry.selectionFor('proto-light')).toEqual({
      brand: '__proto__',
      appearance: 'light',
    });
  });

  it('rejects inherited-looking unknown keys even when runtime callers bypass types', () => {
    const registry = defineThemeRegistry({
      bee: { light: 'light', dark: 'dark' },
    });

    expect(() =>
      (registry.resolve as (brand: string, appearance: string) => string)('toString', 'light'),
    ).toThrow(/unknown brand/);
    expect(() =>
      (registry.resolve as (brand: string, appearance: string) => string)('bee', 'toString'),
    ).toThrow(/unknown appearance/);
  });
});
