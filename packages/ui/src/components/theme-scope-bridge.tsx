import * as React from 'react';
import { ScopedTheme, type ThemeName } from 'uniwind';

export type BeeThemeScopeSnapshot = ThemeName | null;

const BeeThemeScopeContext = React.createContext<BeeThemeScopeSnapshot>(null);

export function BeeThemeScopeMirrorProvider({
  children,
  theme,
}: {
  children?: React.ReactNode;
  theme: ThemeName;
}) {
  return <BeeThemeScopeContext.Provider value={theme}>{children}</BeeThemeScopeContext.Provider>;
}

export function useBeeThemeScopeSnapshot(): BeeThemeScopeSnapshot {
  return React.useContext(BeeThemeScopeContext);
}

export function BeeThemeScopeBridge({
  children,
  snapshot,
}: {
  children?: React.ReactNode;
  snapshot: BeeThemeScopeSnapshot;
}) {
  if (!snapshot) return <>{children}</>;
  return (
    <BeeThemeScopeContext.Provider value={snapshot}>
      <ScopedTheme theme={snapshot}>{children}</ScopedTheme>
    </BeeThemeScopeContext.Provider>
  );
}
