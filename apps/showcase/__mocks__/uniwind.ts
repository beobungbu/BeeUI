export const Uniwind = {
  updateInsets: (_insets: { top: number; right: number; bottom: number; left: number }) => undefined,
};

export function withUniwind<T>(Component: T): T {
  return Component;
}

export function useUniwind() {
  return {
    hasAdaptiveThemes: false,
    theme: 'light',
  };
}
