import { cn } from '@beeui/core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

const semanticTypographyClasses = {
  display:
    'text-[length:var(--text-display)] leading-[var(--text-display--line-height)]',
  title: 'text-[length:var(--text-title)] leading-[var(--text-title--line-height)]',
  heading:
    'text-[length:var(--text-heading)] leading-[var(--text-heading--line-height)]',
  body: 'text-[length:var(--text-body)] leading-[var(--text-body--line-height)]',
  label: 'text-[length:var(--text-label)] leading-[var(--text-label--line-height)]',
  caption:
    'text-[length:var(--text-caption)] leading-[var(--text-caption--line-height)]',
} as const;

// Web resolves data-typography features through generated theme utilities
// (`bee-tabular-nums`, `font-mono`). Native has no equivalent className mapping,
// so it resolves through RN style props. These constants mirror the canonical
// token metadata (numericVariants, monoFontFamily); Showcase tests assert the
// rendered output stays equal to those canonical values so they never drift. They
// are inlined (not imported) to keep the component standalone-portable.
const numericVariantUtilities = {
  tabular: 'bee-tabular-nums',
} as const;

const numericVariantFontVariants = {
  tabular: ['tabular-nums'],
} as const;

const monoFontFamilyUtility = 'font-mono';

const monoFontFamilyNative = {
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
} as const;

export type NumericVariant = keyof typeof numericVariantUtilities;
// `family` is deliberately an opt-in feature, not a two-state font selector.
// Omitting it preserves/inherits the normal sans/system typography contract;
// exposing `sans` here would imply a reset semantic that this component cannot
// safely provide across web/native composition boundaries.
export type FontFamily = 'mono';

const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      display: `${semanticTypographyClasses.display} font-bold tracking-tight`,
      title: `${semanticTypographyClasses.title} font-bold`,
      heading: `${semanticTypographyClasses.heading} font-semibold`,
      body: semanticTypographyClasses.body,
      label: `${semanticTypographyClasses.label} font-semibold`,
      caption: `${semanticTypographyClasses.caption} text-muted-foreground`,
    },
    tone: {
      default: '',
      muted: 'text-muted-foreground',
      subtle: 'text-subtle-foreground',
      primary: 'text-primary',
      destructive: 'text-destructive',
      success: 'text-success',
      warning: 'text-warning',
      info: 'text-info',
    },
  },
  defaultVariants: {
    variant: 'body',
    tone: 'default',
  },
});

/**
 * `numeric="tabular"` opts a numeric value into equal-width (tabular) figures so
 * columns of amounts, KPIs, timers, and reference digits align. `family="mono"`
 * renders reference codes/IDs in the system-monospace fallback stack. Both are
 * orthogonal to the size role and compose with any `variant`, `tone`, weight,
 * alignment, and color — they never replace the six semantic size roles.
 *
 * The family prop is intentionally opt-in (`"mono"` only). Omit it for the
 * normal sans/system contract; there is no fake `family="sans"` value that would
 * type-check without actually resetting an inherited font family.
 *
 * Web resolves the feature through generated utility classes; native resolves it
 * through the React Native `fontVariant`/`fontFamily` styles. No font is bundled
 * or force-loaded; font scaling (Dynamic Type) is left untouched.
 */
export type TextProps = RNTextProps &
  VariantProps<typeof textVariants> & {
    className?: string;
    numeric?: NumericVariant;
    family?: FontFamily;
  };

function dataTypographyStyle(
  numeric: NumericVariant | undefined,
  family: FontFamily | undefined,
): TextStyle | undefined {
  // Web resolves every data-typography feature through the utility classes above,
  // so no inline style is emitted there. An inline `fontFamily`/`fontVariant` would
  // beat the class in the cascade — for mono that would collapse the rich
  // `--font-mono` stack down to the generic `monospace` keyword. Native has no
  // className mapping, so it resolves the same features through RN style props.
  if (Platform.OS === 'web') return undefined;
  const style: TextStyle = {};
  if (numeric) {
    style.fontVariant = [...numericVariantFontVariants[numeric]] as TextStyle['fontVariant'];
  }
  if (family === 'mono') {
    style.fontFamily = Platform.select(monoFontFamilyNative);
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

export const Text = React.forwardRef<React.ComponentRef<typeof RNText>, TextProps>(
  ({ className, variant, tone, numeric, family, style, ...props }, ref) => {
    const dataStyle = dataTypographyStyle(numeric, family);
    return (
      <RNText
        ref={ref}
        className={cn(
          textVariants({ variant, tone }),
          numeric ? numericVariantUtilities[numeric] : undefined,
          family === 'mono' ? monoFontFamilyUtility : undefined,
          className,
        )}
        style={dataStyle ? [dataStyle, style] : style}
        {...props}
      />
    );
  },
);

Text.displayName = 'Text';

export { semanticTypographyClasses, textVariants };
