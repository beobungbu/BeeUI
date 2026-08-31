// AUTO-GENERATED — DO NOT EDIT DIRECTLY.
// Canonical source: packages/tokens/tokens.json
// Generator: scripts/generate-tokens.mjs

import { defineThemeRegistry } from './registry';
import { applyThemeOverrides, createThemeOverridesDefiner, type CompiledThemeOverrides, type OverrideCategoryMap, type ThemeOverridesInput, type UniwindCSSVariableClient } from './theme-overrides';
import { defineTokenReader, type TokenCategoryMap, type TokenPath, type TokenValueForPath } from './token-reader';

export * from './registry';
export * from './theme-overrides';
export * from './token-reader';

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

export const beeAccessibilityBrandNames = [
  "bee"
] as const satisfies readonly BeeBrandName[];

export type BeeAccessibilityBrandName = (typeof beeAccessibilityBrandNames)[number];

export const beeAccessibilityRuntimeThemeNames = [
  "high-contrast-light",
  "high-contrast-dark"
] as const;

export type BeeAccessibilityRuntimeThemeName = (typeof beeAccessibilityRuntimeThemeNames)[number];

export const beeAccessibilityRuntimeThemeByBrand = {
  "bee": {
    "light": "high-contrast-light",
    "dark": "high-contrast-dark"
  }
} as const satisfies Record<BeeAccessibilityBrandName, Record<BeeThemeName, BeeAccessibilityRuntimeThemeName>>;

/**
 * Accessibility (high-contrast) variant registry (#77): a second, optional
 * `brand -> appearance -> runtime-theme` mapping built from the exact same
 * `defineThemeRegistry` primitive as `beeThemeRegistry`. Only brands that ship a
 * certified accessibility appearance appear here — currently just `bee` — so this
 * never forces every brand in `beeThemeRegistry` to define a high-contrast variant.
 * A resolved runtime theme is still applied with the ordinary `Uniwind.setTheme`
 * call; there is no second theme store or context, only a second, narrower registry
 * over the same runtime-theme-name namespace.
 */
export const beeAccessibilityThemeRegistry = defineThemeRegistry(beeAccessibilityRuntimeThemeByBrand);

export function resolveBeeAccessibilityRuntimeTheme(
  brand: BeeAccessibilityBrandName,
  theme: BeeThemeName,
): BeeAccessibilityRuntimeThemeName {
  return beeAccessibilityRuntimeThemeByBrand[brand][theme];
}

export function getBeeAccessibilityThemeSelection(runtimeTheme: string):
  | { brand: BeeAccessibilityBrandName; theme: BeeThemeName }
  | undefined {
  for (const brand of beeAccessibilityBrandNames) {
    for (const theme of beeThemeNames) {
      if (beeAccessibilityRuntimeThemeByBrand[brand][theme] === runtimeTheme) {
        return { brand, theme };
      }
    }
  }

  return undefined;
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

/**
 * Semantic data-visualization (chart) color tokens (#78) — a distinct color
 * vocabulary from `semanticColorTokens` above, never a component/status color.
 * Chart tokens describe chart-rendering roles only (categorical series,
 * positive/negative delta, neutral baseline, highlight/emphasis, gridline, axis)
 * and never reuse a `SemanticColorToken` name; the canonical source enforces this
 * disjointness at generation time. Every shipped runtime theme -- including the
 * #77 accessibility high-contrast themes -- defines a complete, exact set of
 * these tokens (the same completeness rule `semanticColorTokens` gets). Read via
 * the `chart` category of `beeTokenReaderCategories`/`useBeeToken`/`getBeeToken`
 * below (e.g. `useBeeToken('chart.series-1')`), never a separate chart reader.
 */
export const chartColorTokens = [
  "series-1",
  "series-2",
  "series-3",
  "series-4",
  "positive",
  "negative",
  "neutral",
  "highlight",
  "grid",
  "axis"
] as const;

export type SemanticChartToken = (typeof chartColorTokens)[number];
export type SemanticChartVariableName = `--chart-${SemanticChartToken}`;

export function chartColorVariable(token: SemanticChartToken): SemanticChartVariableName {
  return `--chart-${token}`;
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

export type RadiusName = keyof typeof radius;

export type RadiusVariableName = `--radius-${RadiusName}`;

export function radiusVariable(name: RadiusName): RadiusVariableName {
  return `--radius-${name}`;
}

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
 * BeeUI issue #74 — application density semantic axis. `compact`/`comfortable`/`spacious` are the
 * only approved density-mode names, evidence-backed by recurring list-row and form-field
 * spacing/height literals across `ListItem`, `FormGroup`, and `Field`. `comfortable`
 * is the default and preserves the pre-#74 BeeUI v2 visual baseline exactly (see
 * `densityMetrics.*.comfortable` below against each component's prior literal).
 *
 * Density deliberately does NOT scale every spacing/radius/font token: only the metric
 * groups flagged `com.beeui.densityAxis: true` in canonical tokens.json participate
 * (currently `rowHeight`, `rowGap`, `formGap`). Component
 * `size` props (Button, Card, ...), icon geometry, focus-ring geometry, controlSize, and
 * typography are untouched by density — see docs/density.md for the full invariant list
 * and the native interactive hit-target guarantee enforced on `rowHeight` at codegen time.
 */
export const densityModes = [
  "compact",
  "comfortable",
  "spacious"
] as const;

export type DensityMode = (typeof densityModes)[number];

export const defaultDensityMode: DensityMode = "comfortable";

export const densityModeDescriptions = {
  "compact": "Dense desktop/admin surfaces (dashboards, data tables, settings lists) where users benefit from higher information density and precise pointer input. Native interactive hit targets are never reduced below the accepted minimum.",
  "comfortable": "Default application density. Preserves the BeeUI v2 visual baseline exactly.",
  "spacious": "Roomier touch-oriented surfaces and wide desktop layouts where extra breathing room improves scanability."
} as const satisfies Record<DensityMode, string>;

/** Per-mode pixel values for every density-sensitive metric, read from canonical tokens.json. */
export const densityMetrics = {
  "rowHeight": {
    "compact": 44,
    "comfortable": 56,
    "spacious": 64
  },
  "rowGap": {
    "compact": 8,
    "comfortable": 12,
    "spacious": 16
  },
  "formGap": {
    "compact": 4,
    "comfortable": 8,
    "spacious": 12
  }
} as const;

export type DensityMetric = keyof typeof densityMetrics;

/**
 * Uniwind CSS-variable name for one density metric (e.g. `rowHeight` ->
 * `--spacing-density-row-height`). Lives under the same `--spacing-*` namespace as
 * `controlSize`/`pageGutter`, so Tailwind/Uniwind derives the matching `h-*`/`min-h-*`/
 * `gap-*` utility classes the same way it already does for those groups.
 */
export const densityMetricVariables = {
  "rowHeight": "--spacing-density-row-height",
  "rowGap": "--spacing-density-row-gap",
  "formGap": "--spacing-density-form-gap"
} as const satisfies Record<DensityMetric, string>;

function compileDensityPreset(mode: DensityMode): CompiledThemeOverrides {
  const cssVariables: Record<string, string> = {};
  for (const metric of Object.keys(densityMetrics) as DensityMetric[]) {
    cssVariables[densityMetricVariables[metric]] = `${densityMetrics[metric][mode]}px`;
  }
  const orderedNames = Object.keys(cssVariables).sort();
  const ordered: Record<string, string> = {};
  for (const name of orderedNames) ordered[name] = cssVariables[name];
  return Object.freeze({ cssVariables: Object.freeze(ordered) });
}

/**
 * One precompiled #71-shaped `CompiledThemeOverrides` per approved density mode, built at
 * module init from `densityMetrics`. Deterministic and pure — never touches Uniwind.
 */
export const densityPresets: Readonly<Record<DensityMode, CompiledThemeOverrides>> = Object.freeze(
  Object.fromEntries(densityModes.map((mode) => [mode, compileDensityPreset(mode)])),
) as Readonly<Record<DensityMode, CompiledThemeOverrides>>;

/** Resolve one density mode's precompiled override bundle. Throws on an unknown mode instead of silently returning `undefined`. */
export function resolveDensityOverrides(mode: DensityMode): CompiledThemeOverrides {
  if (!Object.prototype.hasOwnProperty.call(densityPresets, mode)) {
    throw new Error(`Unknown density mode "${String(mode)}"; supported modes: ${densityModes.join(', ')}`);
  }
  return densityPresets[mode];
}

/**
 * Apply one density mode to a named Uniwind runtime theme. A thin call-through to the
 * existing #71 `applyThemeOverrides` — BeeUI keeps no separate density store, cache, React
 * context, or provider (see `applyThemeOverrides` in theme-overrides.ts for the exact
 * contract this reuses). Like #71 overrides, and #68's `ScopedTheme`, this targets exactly
 * one named runtime theme: density has no scoped/subtree application surface in this
 * release (see docs/density.md for why, and the deferred path if that changes).
 */
export function applyDensity<RuntimeThemeName extends string>(
  uniwind: UniwindCSSVariableClient<RuntimeThemeName>,
  runtimeTheme: RuntimeThemeName,
  mode: DensityMode,
): void {
  applyThemeOverrides(uniwind, runtimeTheme, resolveDensityOverrides(mode));
}

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

export type MotionDurationName = keyof typeof motionDuration;

export type MotionDurationVariableName = `--motion-duration-${MotionDurationName}`;

export function motionDurationVariable(name: MotionDurationName): MotionDurationVariableName {
  return `--motion-duration-${name}`;
}

export const motionEasing = {
  "standard": "cubic-bezier(0.2, 0, 0, 1)",
  "emphasized": "cubic-bezier(0.2, 0, 0, 1.2)"
} as const;

export const motionIntents = [
  "overlay-enter",
  "overlay-exit",
  "sheet-enter",
  "sheet-exit",
  "disclosure"
] as const;

export type MotionIntent = (typeof motionIntents)[number];

/**
 * Reduced-motion policy per intent. Chosen from the four BeeUI-supported strategies:
 * - `immediate`: skip animation entirely and jump to the final state;
 * - `opacity-or-state`: keep the opacity/state change, drop spatial (transform/size) motion;
 * - `shorten`: keep the motion but clamp its duration to the fast token;
 * - `remove-spatial`: keep non-spatial timing, drop spatial motion.
 */
export type MotionReducedMotionPolicy = 'immediate' | 'opacity-or-state' | 'shorten' | 'remove-spatial';

/**
 * Semantic motion vocabulary for recurring spatial/state transitions.
 *
 * Token presence never makes animation mandatory. Web and native representations may
 * differ while sharing a semantic intent; no frame- or time-identical parity is promised.
 * Raw spring physics (`stiffness`, `damping`, `mass`; unitless React-Native spring units)
 * are an implementation detail behind the semantic name, not the primary public API.
 */
export const motion = {
  "overlay-enter": {
    "web": {
      "durationMs": 200,
      "easing": "cubic-bezier(0.2, 0, 0, 1)",
      "properties": [
        "opacity",
        "transform"
      ]
    },
    "native": {
      "type": "spring",
      "stiffness": 260,
      "damping": 26,
      "mass": 1
    },
    "reducedMotion": "opacity-or-state"
  },
  "overlay-exit": {
    "web": {
      "durationMs": 120,
      "easing": "cubic-bezier(0.2, 0, 0, 1)",
      "properties": [
        "opacity",
        "transform"
      ]
    },
    "native": {
      "type": "timing",
      "durationMs": 120,
      "easing": [
        0.2,
        0,
        0,
        1
      ]
    },
    "reducedMotion": "immediate"
  },
  "sheet-enter": {
    "web": {
      "durationMs": 200,
      "easing": "cubic-bezier(0.2, 0, 0, 1)",
      "properties": [
        "opacity",
        "transform"
      ]
    },
    "native": {
      "type": "spring",
      "stiffness": 260,
      "damping": 26,
      "mass": 1
    },
    "reducedMotion": "opacity-or-state"
  },
  "sheet-exit": {
    "web": {
      "durationMs": 120,
      "easing": "cubic-bezier(0.2, 0, 0, 1)",
      "properties": [
        "opacity",
        "transform"
      ]
    },
    "native": {
      "type": "timing",
      "durationMs": 120,
      "easing": [
        0.2,
        0,
        0,
        1
      ]
    },
    "reducedMotion": "immediate"
  },
  "disclosure": {
    "web": {
      "durationMs": 200,
      "easing": "cubic-bezier(0.2, 0, 0, 1)",
      "properties": [
        "height",
        "opacity"
      ]
    },
    "native": {
      "type": "timing",
      "durationMs": 200,
      "easing": [
        0.2,
        0,
        0,
        1
      ]
    },
    "reducedMotion": "immediate"
  }
} as const;

export type MotionSpec = (typeof motion)[MotionIntent];

export type ResolvedMotion = {
  /** Whether the caller should animate at all (false means jump to the final state). */
  animate: boolean;
  /** Effective web duration in milliseconds after any reduced-motion policy. */
  durationMs: number;
  /** Whether spatial (transform/size) motion should be applied. */
  spatial: boolean;
  /** Whether a reduced-motion policy changed the base specification. */
  reducedMotionApplied: boolean;
};

/**
 * Resolve a semantic motion intent against the caller-supplied reduced-motion signal.
 *
 * BeeUI adds no motion/preference store: the platform or app owns the reduced-motion
 * signal (e.g. `AccessibilityInfo.isReduceMotionEnabled` on native, the
 * `prefers-reduced-motion` media query on web) and passes it in. The final state is the
 * same in every branch; reduced motion only changes how (or whether) the transition plays.
 */
export function resolveMotion(
  intent: MotionIntent,
  options: { reducedMotion?: boolean } = {},
): ResolvedMotion {
  const spec = motion[intent];
  const baseDurationMs = spec.web.durationMs;
  const spatialByDefault = spec.web.properties.some(
    (property) => property === 'transform' || property === 'height',
  );

  if (!options.reducedMotion) {
    return {
      animate: true,
      durationMs: baseDurationMs,
      spatial: spatialByDefault,
      reducedMotionApplied: false,
    };
  }

  // The active intents only use a subset of policies; the exhaustive switch keeps the
  // resolver correct if a future intent adopts `shorten` or `remove-spatial`.
  switch (spec.reducedMotion as MotionReducedMotionPolicy) {
    case 'immediate':
      return { animate: false, durationMs: 0, spatial: false, reducedMotionApplied: true };
    case 'shorten':
      return {
        animate: true,
        durationMs: Math.min(baseDurationMs, motionDuration.fast),
        spatial: spatialByDefault,
        reducedMotionApplied: true,
      };
    case 'opacity-or-state':
    case 'remove-spatial':
      return {
        animate: true,
        durationMs: baseDurationMs,
        spatial: false,
        reducedMotionApplied: true,
      };
  }
}

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

/**
 * Runtime-override safety classification (#71) for every canonical token group,
 * generated straight from each group's `$extensions.com.beeui` metadata (see
 * tokens.json). `runtimeOverridable: true` is the only signal that gates a
 * group into `themeOverrideCategories` below; every other group is public but
 * build-time/invariant. The private authoring token group has its own
 * visibility flag (see `privateTokenGroups` in `$extensions.com.beeui`) and
 * is never a `tokens.tokens` group, so it never appears in this table. Colors
 * have their own established public/private classification
 * (`semanticColorDescriptions` / `privateTokenGroups`) and are not repeated here.
 */
export const themeOverrideClassification = {
  "spacing": {
    "runtimeOverridable": false
  },
  "radius": {
    "layer": "cross-platform",
    "binding": "value",
    "runtimeOverridable": true,
    "engine": "tailwind-uniwind"
  },
  "fontFamily": {
    "runtimeOverridable": false
  },
  "fontSize": {
    "runtimeOverridable": false
  },
  "lineHeight": {
    "runtimeOverridable": false
  },
  "fontWeight": {
    "runtimeOverridable": false
  },
  "letterSpacing": {
    "runtimeOverridable": false
  },
  "controlSize": {
    "runtimeOverridable": false
  },
  "iconSize": {
    "runtimeOverridable": false
  },
  "avatarSize": {
    "runtimeOverridable": false
  },
  "contentWidth": {
    "layer": "cross-platform",
    "binding": "value",
    "runtimeOverridable": false
  },
  "elevation": {
    "runtimeOverridable": false
  },
  "motionDuration": {
    "layer": "cross-platform",
    "binding": "value",
    "runtimeOverridable": true,
    "engine": "tailwind-uniwind"
  },
  "motionEasing": {
    "runtimeOverridable": false
  },
  "focusRing": {
    "runtimeOverridable": false
  },
  "layer": {
    "runtimeOverridable": false
  },
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
  "rowHeight": {
    "layer": "cross-platform",
    "binding": "value",
    "runtimeOverridable": false
  },
  "rowGap": {
    "layer": "cross-platform",
    "binding": "value",
    "runtimeOverridable": false
  },
  "formGap": {
    "layer": "cross-platform",
    "binding": "value",
    "runtimeOverridable": false
  }
} as const;

/**
 * BeeUI's #71 typed runtime-override category vocabulary, instantiated from
 * canonical, codegen-derived data. `colors` mirrors the existing
 * `semanticColorTokens` vocabulary (kept for `defineSemanticColorOverrides`
 * compatibility -- both compile to the identical `--color-*` representation).
 * Every other category here exists only because its source token group is
 * flagged `runtimeOverridable: true` in `themeOverrideClassification` above:
 * unsetting that flag and regenerating removes the category, and every
 * category's accepted `keys` are read live from the already-generated token
 * record (never a hand-maintained parallel list of names).
 */
const themeOverrideCategories = {
  colors: {
    keys: semanticColorTokens,
    valueKind: 'string',
    variable: (key: SemanticColorToken) => semanticColorVariable(key),
    format: (value: string) => value,
  },
  radius: {
    keys: Object.keys(radius) as (keyof typeof radius)[],
    valueKind: 'number',
    variable: (key: keyof typeof radius) => `--radius-${key}` as const,
    format: (value: number) => `${value}px`,
  },
  motion: {
    keys: Object.keys(motionDuration) as (keyof typeof motionDuration)[],
    valueKind: 'number',
    variable: (key: keyof typeof motionDuration) => `--motion-duration-${key}` as const,
    format: (value: number) => `${value}ms`,
  },
} as const satisfies OverrideCategoryMap;

/**
 * Typed, validated runtime-override definer for the supported safe
 * runtime-overridable public token categories. Pure define/validate/compile:
 * unknown categories, unknown keys within a known category (which includes
 * every private authoring primitive and every build-time-only/invariant
 * token -- see `themeOverrideClassification`), and wrong-kind values are all
 * rejected. Applying the compiled result to Uniwind is always a separate,
 * explicit `applyThemeOverrides()` call -- this function itself never touches
 * Uniwind, `document`, or any global state.
 *
 * ```ts
 * const overrides = defineThemeOverrides({
 *   colors: { primary: '#123456', focusRing: '#654321' },
 *   radius: { md: 12 },
 *   motion: { normal: 180 },
 * });
 * applyThemeOverrides(Uniwind, 'light', overrides);
 * ```
 *
 * `defineSemanticColorOverrides()` remains available unchanged for existing
 * color-only consumers; `defineThemeOverrides({ colors: { primary: '#123456' } })`
 * compiles to the identical `--color-primary` CSS-variable entry.
 */
export const defineThemeOverrides = createThemeOverridesDefiner(themeOverrideCategories);

/** The exact object shape `defineThemeOverrides` accepts. */
export type ThemeOverrides = ThemeOverridesInput<typeof themeOverrideCategories>;

/**
 * BeeUI's #72 typed runtime-token-read category vocabulary, instantiated from
 * canonical, codegen-derived data. Deliberately the same category set as
 * `themeOverrideCategories` above (`colors`, `radius`, `motion`) and nothing
 * else: every readable category here is real-runtime-reactive -- its value can
 * differ between the initial build and the live app, either because it is
 * theme/appearance/scope-dependent (`colors`) or because #71 lets it be
 * overridden at runtime (`radius`, `motion`). Every other canonical token
 * group is theme-invariant and never runtime-mutable, so it stays an ordinary
 * typed export (e.g. `spacing`, `fontSize`, `layer`) rather than gaining a
 * runtime-reader category -- see `docs/data-typography.md`'s "Runtime-reader
 * note" and `token-reader.ts`'s module documentation for the full rationale.
 */
export const beeTokenReaderCategories = {
  colors: {
    kind: 'color',
    keys: semanticColorTokens,
    variable: (key: SemanticColorToken) => semanticColorVariable(key),
  },
  chart: {
    kind: 'color',
    keys: chartColorTokens,
    variable: (key: SemanticChartToken) => chartColorVariable(key),
  },
  radius: {
    kind: 'dimension',
    keys: Object.keys(radius) as RadiusName[],
    variable: (key: RadiusName) => radiusVariable(key),
  },
  motion: {
    kind: 'duration',
    keys: Object.keys(motionDuration) as MotionDurationName[],
    variable: (key: MotionDurationName) => motionDurationVariable(key),
  },
} as const satisfies TokenCategoryMap;

/**
 * BeeUI's #72 typed runtime-token reader. Pure and stateless: only derives
 * valid `category.key` paths and their Uniwind CSS-variable name from
 * canonical metadata (see `token-reader.ts`). It never reads Uniwind itself --
 * `useBeeToken`/`getBeeToken` in `@beemvp/beeui-ui` (`use-bee-token.ts`) are the only
 * place this feature actually calls into Uniwind, so `@beemvp/beeui-tokens` keeps
 * zero dependency on `uniwind` or React, exactly like `beeThemeRegistry` and
 * `defineThemeOverrides` above.
 */
export const beeTokenReader = defineTokenReader(beeTokenReaderCategories);

/** Every valid runtime-readable token path, e.g. `colors.primary` | `radius.md` | `motion.normal`. */
export type BeeTokenPath = TokenPath<typeof beeTokenReaderCategories>;

/** The normalized TypeScript return type for one specific `BeeTokenPath`. */
export type BeeTokenValue<Path extends BeeTokenPath> = TokenValueForPath<typeof beeTokenReaderCategories, Path>;

export type ContrastTextPair = {
  readonly foreground: SemanticColorToken;
  readonly backgrounds: readonly SemanticColorToken[];
  readonly minRatio: number;
  readonly usage: string;
};

export type ContrastFeedbackFillPair = {
  readonly fill: SemanticColorToken;
  readonly foreground: SemanticColorToken;
  readonly minRatio: number;
  readonly usage: string;
};

export type ContrastBoundaryPair = {
  readonly boundary: SemanticColorToken;
  readonly adjacent: readonly SemanticColorToken[];
  readonly minRatio: number;
  readonly usage: string;
};

export type ContrastIndicatorPair = {
  readonly indicator: SemanticColorToken;
  readonly adjacent: readonly SemanticColorToken[];
  readonly minRatio: number;
  readonly usage: string;
};

export type ContrastException = {
  readonly token: SemanticColorToken;
  readonly category: string;
  readonly reason: string;
};

/**
 * Centralized, deterministic semantic contrast-relationship metadata (#77).
 *
 * This is the canonical, machine-tested description of which semantic-token
 * relationships BeeUI certifies for contrast, and at what minimum ratio — moving
 * the contract from ad-hoc test code into data every runtime theme (built-in
 * brand themes and accessibility high-contrast themes alike) is validated
 * against at codegen time. `canvasTokens` lists tokens that are backdrops, not
 * content, so they carry no contrast requirement of their own. Every other
 * semantic color token is covered by at least one required relationship below or
 * by a documented entry in `exceptions` — nothing is silently uncertified.
 * `accessibilityOnlyPairs` and `accessibilityMinTextRatio` are certified only for
 * `beeAccessibilityRuntimeThemeNames`, not the default brand themes.
 */
export type ContrastContract = {
  readonly description: string;
  readonly canvasTokens: readonly SemanticColorToken[];
  readonly textPairs: readonly ContrastTextPair[];
  readonly filledActionPairs: readonly ContrastTextPair[];
  readonly feedbackFillPairs: readonly ContrastFeedbackFillPair[];
  readonly controlBoundaryPairs: readonly ContrastBoundaryPair[];
  readonly focusRingPairs: readonly ContrastBoundaryPair[];
  readonly invalidBoundaryPairs: readonly ContrastBoundaryPair[];
  readonly essentialIndicatorPairs: readonly ContrastIndicatorPair[];
  readonly accessibilityOnlyPairs: readonly ContrastBoundaryPair[];
  readonly accessibilityMinTextRatio: number;
  readonly exceptions: readonly ContrastException[];
};

export const contrastContract = {
  "description": "Deterministic, machine-tested semantic contrast relationships that mirror actual component surface/state adjacency. Canvas tokens and documented exceptions are intentionally excluded so the matrix never claims a relationship BeeUI does not certify. All runtime themes (built-in brand themes and accessibility high-contrast themes) must satisfy every entry below; accessibilityOnlyPairs and accessibilityMinTextRatio apply only to accessibilityRuntimeThemeNames.",
  "canvasTokens": [
    "background",
    "surface",
    "surface-muted",
    "surface-raised",
    "muted",
    "input"
  ],
  "textPairs": [
    {
      "foreground": "foreground",
      "backgrounds": [
        "background",
        "surface",
        "surface-muted",
        "surface-raised",
        "muted"
      ],
      "minRatio": 4.5,
      "usage": "Primary body/heading text on every realistic canvas."
    },
    {
      "foreground": "muted-foreground",
      "backgrounds": [
        "background",
        "surface-muted",
        "surface-raised"
      ],
      "minRatio": 4.5,
      "usage": "Secondary/muted text on the page, muted-card, and raised-card canvases."
    }
  ],
  "filledActionPairs": [
    {
      "foreground": "primary-foreground",
      "backgrounds": [
        "primary",
        "primary-hover",
        "primary-pressed"
      ],
      "minRatio": 4.5,
      "usage": "Primary filled action label across default/hover/pressed (#65)."
    },
    {
      "foreground": "secondary-foreground",
      "backgrounds": [
        "secondary",
        "secondary-hover",
        "secondary-pressed"
      ],
      "minRatio": 4.5,
      "usage": "Secondary filled action label across default/hover/pressed (#65)."
    },
    {
      "foreground": "destructive-foreground",
      "backgrounds": [
        "destructive",
        "destructive-hover",
        "destructive-pressed"
      ],
      "minRatio": 4.5,
      "usage": "Destructive filled action label across default/hover/pressed (#65)."
    }
  ],
  "feedbackFillPairs": [
    {
      "fill": "success",
      "foreground": "success-foreground",
      "minRatio": 4.5,
      "usage": "Success badge/banner fill with its foreground text."
    },
    {
      "fill": "warning",
      "foreground": "warning-foreground",
      "minRatio": 4.5,
      "usage": "Warning badge/banner fill with its foreground text."
    },
    {
      "fill": "info",
      "foreground": "info-foreground",
      "minRatio": 4.5,
      "usage": "Info badge/banner fill with its foreground text."
    }
  ],
  "controlBoundaryPairs": [
    {
      "boundary": "control-border",
      "adjacent": [
        "input"
      ],
      "minRatio": 3,
      "usage": "Text input boundary against the input surface (#66)."
    }
  ],
  "focusRingPairs": [
    {
      "boundary": "focus-ring",
      "adjacent": [
        "background",
        "input",
        "surface",
        "surface-muted",
        "surface-raised"
      ],
      "minRatio": 3,
      "usage": "Focus ring against every realistic adjacent surface it can appear on (#66, expanded by #77 to include surface-raised)."
    }
  ],
  "invalidBoundaryPairs": [
    {
      "boundary": "destructive",
      "adjacent": [
        "input",
        "surface",
        "surface-raised",
        "surface-muted"
      ],
      "minRatio": 3,
      "usage": "Invalid/destructive control boundary against realistic surfaces (#66)."
    }
  ],
  "essentialIndicatorPairs": [
    {
      "indicator": "success",
      "adjacent": [
        "surface"
      ],
      "minRatio": 3,
      "usage": "Essential non-text status indicator (icon/dot) legibility."
    },
    {
      "indicator": "warning",
      "adjacent": [
        "surface"
      ],
      "minRatio": 3,
      "usage": "Essential non-text status indicator (icon/dot) legibility."
    },
    {
      "indicator": "info",
      "adjacent": [
        "surface"
      ],
      "minRatio": 3,
      "usage": "Essential non-text status indicator (icon/dot) legibility."
    },
    {
      "indicator": "destructive",
      "adjacent": [
        "surface"
      ],
      "minRatio": 3,
      "usage": "Essential non-text status indicator (icon/dot) legibility."
    }
  ],
  "accessibilityOnlyPairs": [
    {
      "boundary": "border-strong",
      "adjacent": [
        "input"
      ],
      "minRatio": 3,
      "usage": "Checkbox/Radio unchecked boundary. Certified only for accessibilityRuntimeThemeNames; default light/dark/violet-light/violet-dark are not yet certified for this relationship (tracked separately, out of #77 scope)."
    }
  ],
  "accessibilityMinTextRatio": 7,
  "exceptions": [
    {
      "token": "subtle-foreground",
      "category": "decorative-low-emphasis",
      "reason": "Low-emphasis role; intentionally below the 4.5:1 body-text threshold and not approved for normal body copy."
    },
    {
      "token": "disabled",
      "category": "disabled",
      "reason": "Disabled surface fill; inactive-component contrast exemption. Disabled state is also signalled by reduced opacity, not color alone."
    },
    {
      "token": "disabled-foreground",
      "category": "disabled",
      "reason": "Disabled text/icon foreground; same inactive-component exemption as disabled."
    },
    {
      "token": "border",
      "category": "decorative",
      "reason": "Subtle structural divider; decorative and never the sole means of conveying a required boundary or state."
    },
    {
      "token": "border-strong",
      "category": "known-limitation",
      "reason": "Used as the Checkbox/Radio unchecked boundary against input. Default light/dark/violet-light/violet-dark do not yet certify 3:1 for this pair; accessibilityOnlyPairs certifies it for the high-contrast runtime themes. Fixing the default themes is tracked separately and out of #77 scope."
    },
    {
      "token": "overlay",
      "category": "decorative",
      "reason": "Scrim overlay; decorative background dimming, not content."
    }
  ]
} as const satisfies ContrastContract;

export type ChartContrastPair = {
  readonly indicator: SemanticChartToken;
  readonly adjacent: readonly SemanticColorToken[];
  readonly minRatio: number;
  readonly usage: string;
};

export type ChartContrastException = {
  readonly token: SemanticChartToken;
  readonly category: string;
  readonly reason: string;
};

/**
 * Centralized, deterministic chart-token contrast-relationship metadata (#78) --
 * the data-visualization counterpart to `contrastContract` above, kept as its own
 * export (never merged into `contrastContract`) because its `indicator`/`token`
 * fields draw from the `chart` semantic-color domain (`SemanticChartToken`), not
 * `colors` (`SemanticColorToken`). `adjacent` still references ordinary
 * `SemanticColorToken`s -- the real canvas/surface colors a chart renders on.
 * Every chart color token is covered by at least one required relationship in
 * `requiredPairs` or by a documented entry in `exceptions` -- nothing is silently
 * uncertified. Required in every runtime theme (built-in brand themes and
 * accessibility high-contrast themes alike): charts are a general-purpose UI
 * feature, not scoped to a subset of themes.
 */
export type ChartContrastContract = {
  readonly description: string;
  readonly requiredPairs: readonly ChartContrastPair[];
  readonly exceptions: readonly ChartContrastException[];
};

export const chartContrastContract = {
  "description": "Deterministic, machine-tested chart-token contrast relationships (#78), the data-viz counterpart to com.beeui.contrastContract. Scoped to the chart semantic-color domain: each entry's indicator draws from com.beeui.chartColorDescriptions (never a semantic color token), and its adjacent backgrounds draw from the ordinary semantic-color canvas tokens a chart actually renders on. All runtime themes (built-in brand themes and accessibility high-contrast themes alike) must satisfy every required pair below.",
  "requiredPairs": [
    {
      "indicator": "series-1",
      "adjacent": [
        "surface",
        "surface-muted",
        "surface-raised"
      ],
      "minRatio": 3,
      "usage": "Categorical series 1 legibility on every realistic chart canvas."
    },
    {
      "indicator": "series-2",
      "adjacent": [
        "surface",
        "surface-muted",
        "surface-raised"
      ],
      "minRatio": 3,
      "usage": "Categorical series 2 legibility on every realistic chart canvas."
    },
    {
      "indicator": "series-3",
      "adjacent": [
        "surface",
        "surface-muted",
        "surface-raised"
      ],
      "minRatio": 3,
      "usage": "Categorical series 3 legibility on every realistic chart canvas."
    },
    {
      "indicator": "series-4",
      "adjacent": [
        "surface",
        "surface-muted",
        "surface-raised"
      ],
      "minRatio": 3,
      "usage": "Categorical series 4 legibility on every realistic chart canvas."
    },
    {
      "indicator": "positive",
      "adjacent": [
        "surface",
        "surface-muted",
        "surface-raised"
      ],
      "minRatio": 3,
      "usage": "Positive financial/trend delta legibility on every realistic chart canvas."
    },
    {
      "indicator": "negative",
      "adjacent": [
        "surface",
        "surface-muted",
        "surface-raised"
      ],
      "minRatio": 3,
      "usage": "Negative financial/trend delta legibility on every realistic chart canvas."
    },
    {
      "indicator": "neutral",
      "adjacent": [
        "surface",
        "surface-muted",
        "surface-raised"
      ],
      "minRatio": 3,
      "usage": "Flat/baseline series legibility on every realistic chart canvas."
    },
    {
      "indicator": "highlight",
      "adjacent": [
        "surface",
        "surface-muted",
        "surface-raised"
      ],
      "minRatio": 3,
      "usage": "Highlighted/selected series or data-point legibility on every realistic chart canvas."
    },
    {
      "indicator": "axis",
      "adjacent": [
        "surface",
        "surface-muted",
        "surface-raised"
      ],
      "minRatio": 3,
      "usage": "Axis line and tick-label legibility on every realistic chart canvas."
    }
  ],
  "exceptions": [
    {
      "token": "grid",
      "category": "decorative",
      "reason": "Subordinate gridline; decorative structural aid, never the sole means of conveying required chart information (mirrors the colors.border decorative exception)."
    }
  ]
} as const satisfies ChartContrastContract;
