// AUTO-GENERATED — DO NOT EDIT DIRECTLY.
// Canonical source: packages/tokens/tokens.json
// Generator: scripts/generate-tokens.mjs

import { defineThemeRegistry } from './registry';

export * from './registry';

export const beeThemeNames = [
  "light",
  "dark"
] as const;

export type BeeThemeName = (typeof beeThemeNames)[number];

export const beeBrandNames = [
  "bee",
  "violet"
] as const;

export type BeeBrandName = (typeof beeBrandNames)[number];

export const beeRuntimeThemeNames = [
  "light",
  "dark",
  "violet-light",
  "violet-dark"
] as const;

export type BeeRuntimeThemeName = (typeof beeRuntimeThemeNames)[number];

export const beeRuntimeThemeByBrand = {
  "bee": {
    "light": "light",
    "dark": "dark"
  },
  "violet": {
    "light": "violet-light",
    "dark": "violet-dark"
  }
} as const satisfies Record<BeeBrandName, Record<BeeThemeName, BeeRuntimeThemeName>>;

/**
 * The default BeeUI theme registry (Bee + Violet). Built from the same canonical
 * mapping as the standalone helpers, so its `resolve`/`selectionFor` results match
 * `resolveBeeRuntimeTheme`/`getBeeThemeSelection` exactly. Applications may define
 * their own registry with `defineThemeRegistry` without editing BeeUI source.
 */
export const beeThemeRegistry = defineThemeRegistry(beeRuntimeThemeByBrand);

export function resolveBeeRuntimeTheme(
  brand: BeeBrandName,
  theme: BeeThemeName,
): BeeRuntimeThemeName {
  return beeRuntimeThemeByBrand[brand][theme];
}

export function getBeeThemeSelection(runtimeTheme: string):
  | { brand: BeeBrandName; theme: BeeThemeName }
  | undefined {
  for (const brand of beeBrandNames) {
    for (const theme of beeThemeNames) {
      if (beeRuntimeThemeByBrand[brand][theme] === runtimeTheme) {
        return { brand, theme };
      }
    }
  }

  return undefined;
}

export function isBeeDarkRuntimeTheme(runtimeTheme: string) {
  return getBeeThemeSelection(runtimeTheme)?.theme === 'dark';
}

export const semanticColorTokens = [
  "background",
  "foreground",
  "surface",
  "surface-muted",
  "surface-raised",
  "muted",
  "muted-foreground",
  "subtle-foreground",
  "primary",
  "primary-foreground",
  "primary-hover",
  "primary-pressed",
  "secondary",
  "secondary-foreground",
  "secondary-hover",
  "secondary-pressed",
  "destructive",
  "destructive-foreground",
  "destructive-hover",
  "destructive-pressed",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "info",
  "info-foreground",
  "border",
  "border-strong",
  "control-border",
  "input",
  "focus-ring",
  "disabled",
  "disabled-foreground",
  "overlay"
] as const;

export type SemanticColorToken = (typeof semanticColorTokens)[number];
export type SemanticColorVariableName = `--color-${SemanticColorToken}`;
export type SemanticColorOverrides = Partial<Record<SemanticColorVariableName, string>>;

export function semanticColorVariable(token: SemanticColorToken): SemanticColorVariableName {
  return `--color-${token}`;
}

export function defineSemanticColorOverrides<const T extends SemanticColorOverrides>(
  overrides: T,
): Readonly<T> {
  return Object.freeze({ ...overrides });
}

export const spacing = {
  "0": 0,
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "5": 20,
  "6": 24,
  "8": 32,
  "10": 40,
  "12": 48,
  "16": 64,
  "2.5": 10
} as const;

export const radius = {
  "xs": 4,
  "sm": 6,
  "md": 10,
  "lg": 14,
  "xl": 18,
  "2xl": 24,
  "full": 9999
} as const;

/**
 * `system` means the platform default font. BeeUI deliberately does not force a
 * font-family utility until the consuming app loads and names a cross-platform font.
 */
export const fontFamily = {
  "sans": "system",
  "mono": [
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Consolas",
    "Liberation Mono",
    "monospace"
  ]
} as const;

export const fontSize = {
  "caption": 12,
  "label": 14,
  "body": 16,
  "heading": 18,
  "title": 24,
  "display": 32
} as const;

export const lineHeight = {
  "caption": 16,
  "label": 20,
  "body": 24,
  "heading": 24,
  "title": 32,
  "display": 40
} as const;

export const fontWeight = {
  "regular": 400,
  "medium": 500,
  "semibold": 600,
  "bold": 700
} as const;

export const letterSpacing = {
  "normal": 0,
  "tight": -0.2
} as const;

export type TypographyRole = keyof typeof fontSize;

export type FontFamilyToken = keyof typeof fontFamily;

/**
 * Composable numeric typography features. These compose with any of the six
 * semantic size roles (they are never size roles themselves). `webUtilityClass`
 * drives the CSS `font-variant-numeric` utility; `nativeFontVariant` maps to the
 * React Native `fontVariant` style so equal-width figures render on iOS/Android.
 */
export const numericVariants = {
  "tabular": {
    "webUtilityClass": "bee-tabular-nums",
    "cssProperty": "font-variant-numeric",
    "cssValue": "tabular-nums",
    "nativeFontVariant": [
      "tabular-nums"
    ]
  }
} as const;

export type NumericVariant = keyof typeof numericVariants;

/**
 * System-monospace family for reference codes, IDs, and technical values. BeeUI
 * bundles no proprietary font: `stack`/`webUtilityClass` drive the web fallback
 * stack and `native` supplies the per-platform monospace family for React Native.
 * A consuming app may map these to a licensed monospace font it loads itself.
 */
export const monoFontFamily = {
  "webUtilityClass": "font-mono",
  "cssVariable": "--font-mono",
  "stack": [
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Consolas",
    "Liberation Mono",
    "monospace"
  ],
  "native": {
    "ios": "Menlo",
    "android": "monospace",
    "default": "monospace"
  }
} as const;

export const controlSize = {
  "compact": 36,
  "default": 44,
  "large": 48,
  "icon": 44,
  "touchTarget": 44
} as const;

export const iconSize = {
  "xs": 12,
  "sm": 16,
  "md": 20,
  "lg": 24
} as const;

export const avatarSize = {
  "sm": 32,
  "md": 40,
  "lg": 48,
  "xl": 64
} as const;

export const contentWidth = {
  "form": 512,
  "reading": 704,
  "page": 1152,
  "dialog": 512
} as const;

export type ContentWidthName = keyof typeof contentWidth;

/**
 * Minimum stable responsive breakpoints (min-width thresholds, px). Web-only
 * build-time constants — Tailwind/Uniwind compiles these into responsive
 * variants and remains the sole responsive execution engine. Viewports below
 * `medium` are the implicit compact base. These values are readable (e.g. to
 * classify a measured width) but are NOT a runtime override surface: the web
 * compiler needs constant breakpoints, so a runtime-mutable breakpoint API is
 * out of scope here (see #71).
 */
export const breakpoint = {
  "medium": 768,
  "expanded": 1280
} as const;

export type BreakpointName = keyof typeof breakpoint;

/**
 * Semantic horizontal page-edge padding (px). Cross-platform: consumed on web
 * through the generated `--spacing-page-gutter-*` Tailwind utility and on React
 * Native through this constant. Composes additively with safe-area insets —
 * apply the gutter inside the safe area, never in place of the inset.
 */
export const pageGutter = {
  "compact": 16,
  "regular": 20,
  "spacious": 24
} as const;

export type PageGutterName = keyof typeof pageGutter;

/**
 * Build-time vs runtime classification for the responsive-layout token groups.
 * `breakpoint` is a web-only build-time constant; `pageGutter` and
 * `contentWidth` are cross-platform values. None are runtime-overridable.
 */
export const responsiveLayoutClassification = {
  "breakpoint": {
    "layer": "web-responsive",
    "binding": "build-time-constant",
    "runtimeOverridable": false,
    "engine": "tailwind-uniwind"
  },
  "pageGutter": {
    "layer": "cross-platform",
    "binding": "value",
    "runtimeOverridable": false
  },
  "contentWidth": {
    "layer": "cross-platform",
    "binding": "value",
    "runtimeOverridable": false
  }
} as const;

export const elevation = {
  "flat": {
    "web": "none",
    "nativeElevation": 0
  },
  "raised": {
    "web": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    "nativeElevation": 2
  },
  "overlay": {
    "web": "0 16px 40px rgb(16 24 40 / 0.18)",
    "nativeElevation": 8
  }
} as const;

export type ElevationLevel = keyof typeof elevation;

/**
 * Semantic z-order (stacking) contract. Deliberately separate from `elevation`,
 * which encodes shadow depth. Values keep intentional gaps so applications can
 * insert local sublayers between roles without colliding with BeeUI surfaces.
 */
export const layer = {
  "base": 0,
  "overlay": 100,
  "toast": 1000
} as const;

export type LayerName = keyof typeof layer;

export type LayerVariableName = `--layer-${LayerName}`;

export function layerVariable(name: LayerName): LayerVariableName {
  return `--layer-${name}`;
}

export const motionDuration = {
  "fast": 120,
  "normal": 200,
  "slow": 320
} as const;

export const motionEasing = {
  "standard": "cubic-bezier(0.2, 0, 0, 1)",
  "emphasized": "cubic-bezier(0.2, 0, 0, 1.2)"
} as const;

export const focusRing = {
  "width": 2,
  "offset": 2,
  "colorToken": "focus-ring",
  "webVisibility": "focus-visible",
  "nativeVisibility": "platform-focus"
} as const satisfies {
  width: number;
  offset: number;
  colorToken: SemanticColorToken;
  webVisibility: 'focus-visible';
  nativeVisibility: 'platform-focus';
};
