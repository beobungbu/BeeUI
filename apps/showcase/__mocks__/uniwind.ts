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

export const Uniwind = {
  currentTheme: 'light',
  hasAdaptiveThemes: false,
  updateInsets: (_insets: { top: number; right: number; bottom: number; left: number }) => undefined,
  setTheme(theme: string) {
    Uniwind.currentTheme = theme;
    Uniwind.hasAdaptiveThemes = false;
    notify();
  },
};

export function withUniwind<T>(Component: T): T {
  return Component;
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
