import { applyDensity, defaultDensityMode, type DensityMode } from '@beeui/tokens';
import * as React from 'react';
import { I18nManager, Platform } from 'react-native';
import { Uniwind, useUniwind } from 'uniwind';

/**
 * App-owned preferences context (ADR-013 D4/D6). This is a thin preference
 * holder — it wires theme/density/direction/text-scale to BeeUI's *existing*
 * runtimes (Uniwind + `@beeui/tokens`'s `applyDensity` + the platform's own
 * ambient direction authority). It is not a second theme/direction/overlay
 * runtime: BeeUI never gets a parallel implementation here, only a single
 * small piece of application state that decides *which* value those existing
 * runtimes should use, exactly like `apps/showcase`'s `ShowcaseThemeControl`.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type DirectionPreference = 'ltr' | 'rtl';
export type TextScalePreference = 'default' | 'large' | 'largest';

/**
 * Web-only root font-size scale applied so Tailwind's rem-based type scale
 * grows with the preference (react-native-web maps RN's unitless font sizes
 * through rem on Web). Native has no equivalent override: per
 * `docs/dynamic-type.md`, native Dynamic Type is an OS-level ambient setting
 * BeeUI already respects through `allowFontScaling` — the application does
 * not fake a second, in-app font-scale runtime on native. The preference
 * value itself is still tracked on native (for display/continuity in the
 * settings screen, #263) even though it has no native-side effect.
 */
const WEB_TEXT_SCALE_ROOT_FONT_SIZE: Record<TextScalePreference, string> = {
  default: '100%',
  large: '112.5%',
  largest: '125%',
};

export type AppPreferences = {
  density: DensityMode;
  direction: DirectionPreference;
  textScale: TextScalePreference;
  theme: ThemePreference;
};

export type DirectionChangeResult = {
  /**
   * `true` on native: React Native does not retroactively re-mirror
   * already-mounted native view hierarchies when `I18nManager.isRTL`
   * changes (documented platform behavior, ADR-004 "Change/reload
   * expectations on native") — the host application must reload. This
   * scaffold does not bundle an auto-reload dependency (e.g. `expo-updates`)
   * for #258; the settings screen that surfaces this control (#263) is
   * responsible for prompting the user to restart, using this flag.
   */
  restartRequired: boolean;
};

export type AppPreferencesContextValue = AppPreferences & {
  setDensity: (mode: DensityMode) => void;
  setDirection: (direction: DirectionPreference) => DirectionChangeResult;
  setTextScale: (scale: TextScalePreference) => void;
  setTheme: (theme: ThemePreference) => void;
};

function readAmbientDirection(): DirectionPreference {
  if (Platform.OS === 'web') {
    const doc = (globalThis as { document?: { documentElement?: { dir?: string } } }).document;
    return doc?.documentElement?.dir === 'rtl' ? 'rtl' : 'ltr';
  }
  return I18nManager.isRTL ? 'rtl' : 'ltr';
}

function writeWebDirection(direction: DirectionPreference): void {
  const doc = (globalThis as { document?: { documentElement?: { dir: string } } }).document;
  if (doc?.documentElement) {
    doc.documentElement.dir = direction;
  }
}

const AppPreferencesContext = React.createContext<AppPreferencesContextValue | null>(null);

export function AppPreferencesProvider({ children }: { children?: React.ReactNode }) {
  const { theme: resolvedRuntimeTheme } = useUniwind();
  const [theme, setThemeState] = React.useState<ThemePreference>('system');
  const [density, setDensityState] = React.useState<DensityMode>(defaultDensityMode);
  const [direction, setDirectionState] = React.useState<DirectionPreference>(() => readAmbientDirection());
  const [textScale, setTextScaleState] = React.useState<TextScalePreference>('default');

  // Re-apply the density preset whenever either the density mode or the
  // active resolved runtime theme changes — `applyDensity` targets exactly
  // one named Uniwind runtime theme (docs/density.md), so switching theme
  // (e.g. light -> dark) needs the same preset re-applied to the new name.
  React.useEffect(() => {
    applyDensity(Uniwind, resolvedRuntimeTheme, density);
  }, [density, resolvedRuntimeTheme]);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc = (globalThis as { document?: { documentElement?: { style: { fontSize: string } } } })
      .document;
    if (doc?.documentElement) {
      doc.documentElement.style.fontSize = WEB_TEXT_SCALE_ROOT_FONT_SIZE[textScale];
    }
  }, [textScale]);

  const setTheme = React.useCallback((next: ThemePreference) => {
    setThemeState(next);
    Uniwind.setTheme(next);
  }, []);

  const setDensity = React.useCallback((mode: DensityMode) => {
    setDensityState(mode);
  }, []);

  const setDirection = React.useCallback((next: DirectionPreference): DirectionChangeResult => {
    setDirectionState(next);

    if (Platform.OS === 'web') {
      writeWebDirection(next);
      // Web has no automatic re-render on a `dir` change (ADR-004 "Change
      // expectations on Web") — `setDirectionState` above re-renders this
      // provider's own subtree, which every BeeUI consumer keys off of via
      // `key={direction}` at the shell root (see `src/shell/app-shell.tsx`),
      // satisfying that contract without a second observer/store.
      return { restartRequired: false };
    }

    I18nManager.allowRTL(next === 'rtl');
    I18nManager.forceRTL(next === 'rtl');
    return { restartRequired: true };
  }, []);

  const setTextScale = React.useCallback((scale: TextScalePreference) => {
    setTextScaleState(scale);
  }, []);

  const value = React.useMemo<AppPreferencesContextValue>(
    () => ({ density, direction, setDensity, setDirection, setTextScale, setTheme, textScale, theme }),
    [density, direction, setDensity, setDirection, setTextScale, setTheme, textScale, theme],
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences(): AppPreferencesContextValue {
  const context = React.useContext(AppPreferencesContext);
  if (!context) {
    throw new Error('useAppPreferences must be used within an AppPreferencesProvider');
  }
  return context;
}
