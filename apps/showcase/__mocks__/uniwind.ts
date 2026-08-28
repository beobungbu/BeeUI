import * as React from 'react';

// This mock mirrors the real `uniwind@1.10.1` package closely enough to prove
// context-delegation behavior (BeeThemeScope -> Uniwind's ScopedTheme -> Uniwind's
// useUniwind) deterministically in Jest, without depending on Uniwind's real
// CSS/native style engine (which needs a live DOM/native runtime jsdom/RN-testing
// cannot provide). The shape below was verified against the published package
// source for the pinned version:
// - `ScopedTheme` renders a `UniwindContext.Provider` with
//   `{ ...parentContext, scopedTheme: theme }` (dist/module/components/ScopedTheme/ScopedTheme.js).
// - `useUniwind()` returns `uniwindContext.scopedTheme ?? currentGlobalTheme`, and
//   only subscribes to global theme changes when NOT inside a scope
//   (dist/module/hooks/useUniwind.js).
// - `useCSSVariable(name)` reads through the SAME ambient scope context (unlike
//   `useUniwind`, it subscribes unconditionally — a #71-style runtime-variable
//   change must be observable even inside a scope whose theme *name* did not
//   change) and `Uniwind.getCSSVariable(name)` is the non-hook form, which the
//   real package hardcodes to `{ scopedTheme: null }` — global theme only, ever
//   (dist/module/hooks/useCSSVariable/useCSSVariable.js,
//   dist/module/core/config/config.common.js). `Uniwind.updateCSSVariables`
//   writes into the per-runtime-theme variable table both reads resolve
//   against, so an override is visible to a later read with no separate cache.
// A scoped theme therefore always wins over the global theme for any consumer
// inside its React subtree, and a global `Uniwind.setTheme()` call never
// overrides an explicit child scope — exactly the semantics #68's BeeThemeScope
// delegates to.

export type ThemeName = string;

type UniwindContextValue = { scopedTheme: string | null };

const UniwindContext = React.createContext<UniwindContextValue>({ scopedTheme: null });

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

// Deterministic per-runtime-theme CSS-variable table this mock resolves
// `useCSSVariable`/`Uniwind.getCSSVariable` reads against. Seeded with
// distinct values per runtime theme (so a test can prove the "active theme"
// resolves, not a hardcoded single value) and, deliberately, a mix of `number`
// (radius/motion — matching Uniwind's native representation) and `string`
// (colors — matching Uniwind's own web/native color-string normalization),
// exactly the platform/kind split `useCSSVariable`'s own JSDoc documents
// ("On web it is always a string ...; on native it can be a string or a
// number"). `Uniwind.updateCSSVariables` can additionally write a
// string-with-unit value (e.g. `'12px'`), proving BeeUI's reader normalizes
// both raw shapes to the same typed value.
const DEFAULT_VARIABLES: Record<string, Record<string, string | number>> = {
  light: {
    '--color-primary': '#f59e0b',
    '--color-background': '#ffffff',
    '--radius-md': 10,
    '--motion-duration-normal': 200,
  },
  dark: {
    '--color-primary': '#fbbf24',
    '--color-background': '#0b0f14',
    '--radius-md': 10,
    '--motion-duration-normal': 200,
  },
  'violet-light': {
    '--color-primary': '#7c3aed',
    '--color-background': '#ffffff',
    '--radius-md': 10,
    '--motion-duration-normal': 200,
  },
  'violet-dark': {
    '--color-primary': '#a78bfa',
    '--color-background': '#100c1c',
    '--radius-md': 10,
    '--motion-duration-normal': 200,
  },
  // #77 — Bee accessibility (high-contrast) runtime themes. Values match the
  // real generated packages/tokens/src/theme.css exactly (see
  // __tests__/theme-tokens-v3-high-contrast.test.tsx, which re-derives these
  // from the generated CSS rather than hardcoding them), so a test resolving
  // through this mock proves the same thing the #72/#68 fixtures above prove
  // for the primary brand registry: real production values, not arbitrary
  // fixture data.
  'high-contrast-light': {
    '--color-primary': '#6b3410',
    '--color-background': '#ffffff',
    '--radius-md': 10,
    '--motion-duration-normal': 200,
  },
  'high-contrast-dark': {
    '--color-primary': '#ffb84d',
    '--color-background': '#000000',
    '--radius-md': 10,
    '--motion-duration-normal': 200,
  },
};

let variables: Record<string, Record<string, string | number>> = structuredClone(DEFAULT_VARIABLES);

/** Test-only: restore the variable table to its seeded defaults between tests. */
export function __resetUniwindMockVariables() {
  variables = structuredClone(DEFAULT_VARIABLES);
}

export const Uniwind = {
  currentTheme: 'light',
  hasAdaptiveThemes: false,
  updateInsets: (_insets: { top: number; right: number; bottom: number; left: number }) => undefined,
  setTheme(theme: string) {
    Uniwind.currentTheme = theme;
    Uniwind.hasAdaptiveThemes = false;
    notify();
  },
  updateCSSVariables(theme: string, vars: Record<string, string | number>) {
    variables[theme] = { ...(variables[theme] ?? {}), ...vars };
    notify();
  },
  // Real Uniwind hardcodes `{ scopedTheme: null }` here — this always reads
  // the global theme, never an ambient `ScopedTheme`/`BeeThemeScope`.
  getCSSVariable(name: string): string | number | undefined {
    return variables[Uniwind.currentTheme]?.[name];
  },
};

export function withUniwind<T>(Component: T): T {
  return Component;
}

export function useCSSVariable(name: string): string | number | undefined {
  const { scopedTheme } = React.useContext(UniwindContext);

  const subscribe = React.useCallback((onStoreChange: () => void) => {
    listeners.add(onStoreChange);
    return () => listeners.delete(onStoreChange);
  }, []);
  // Reads `Uniwind.currentTheme` fresh *inside* the snapshot function (rather
  // than from a pre-computed outer variable) — React calls the previous
  // render's `getSnapshot` closure to detect a change before deciding to
  // re-render, so the theme lookup must happen at call time, exactly like the
  // real `useUniwind()` above.
  const getSnapshot = React.useCallback(
    () => variables[scopedTheme ?? Uniwind.currentTheme]?.[name],
    [scopedTheme, name],
  );

  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useUniwind() {
  const { scopedTheme } = React.useContext(UniwindContext);

  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (scopedTheme !== null) return () => undefined;
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    [scopedTheme],
  );
  const getSnapshot = React.useCallback(
    () => (scopedTheme !== null ? scopedTheme : Uniwind.currentTheme),
    [scopedTheme],
  );
  const theme = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    theme,
    hasAdaptiveThemes: scopedTheme !== null ? false : Uniwind.hasAdaptiveThemes,
  };
}

export const ScopedTheme: React.FC<React.PropsWithChildren<{ theme: string }>> = ({
  theme,
  children,
}) => {
  const parent = React.useContext(UniwindContext);
  const value = React.useMemo<UniwindContextValue>(
    () => ({ ...parent, scopedTheme: theme }),
    [parent, theme],
  );
  return React.createElement(UniwindContext.Provider, { value }, children);
};
