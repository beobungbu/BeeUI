import { semanticColorVariable, type SemanticColorToken } from '@beemvp/beeui-tokens';
import * as React from 'react';
import {
  ActivityIndicator,
  Platform,
  type ActivityIndicatorProps,
} from 'react-native';

type SpinnerTone =
  | 'foreground'
  | 'muted'
  | 'primary'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info';

type EngineActivityIndicatorProps = ActivityIndicatorProps & {
  colorClassName?: string;
};

const spinnerToneClasses: Record<SpinnerTone, string> = {
  foreground: 'accent-foreground',
  muted: 'accent-muted-foreground',
  primary: 'accent-primary',
  success: 'accent-success',
  warning: 'accent-warning',
  destructive: 'accent-destructive',
  info: 'accent-info',
};

// On Web the arc colour references the theme variable directly instead of going through
// Uniwind's `colorClassName` accent bridge. That bridge reads the stylesheet's rules during
// the first render; a Spinner is typically on screen exactly then (a cold load), and when
// the stylesheet reaches the page after that render (Metro's development server can deliver
// it late) the colour comes back empty, logs "className 'accent-primary' ... no color was
// found", and the arc stays on react-native-web's default blue until something re-renders
// it. A `var()` colour is resolved by the browser whenever the stylesheet lands and follows
// theme and `BeeThemeScope` switches with no re-render.
const spinnerToneColorTokens: Record<SpinnerTone, SemanticColorToken> = {
  foreground: 'foreground',
  muted: 'muted-foreground',
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  destructive: 'destructive',
  info: 'info',
};

export type SpinnerProps = Omit<ActivityIndicatorProps, 'color'> & {
  className?: string;
  /** Semantic color the spinner renders in (e.g. `'destructive'` for an inline error-state spinner). Defaults to `'primary'`. */
  tone?: SpinnerTone;
};

export const Spinner = React.forwardRef<
  React.ComponentRef<typeof ActivityIndicator>,
  SpinnerProps
>(({ accessibilityLabel, accessibilityLabelledBy, tone = 'primary', ...props }, ref) => {
  // react-native-web's ActivityIndicator always renders `role="progressbar"`
  // (WAI-ARIA `accessibleNameRequired`), so fall back to a generic, non-brand
  // default only when the caller hasn't supplied their own label/labelledby.
  const resolvedAccessibilityLabel =
    accessibilityLabel ?? (accessibilityLabelledBy ? undefined : 'Loading');
  const engineProps: EngineActivityIndicatorProps = {
    ...props,
    accessibilityLabel: resolvedAccessibilityLabel,
    accessibilityLabelledBy,
    ...(Platform.OS === 'web'
      ? { color: `var(${semanticColorVariable(spinnerToneColorTokens[tone])})` }
      : { colorClassName: spinnerToneClasses[tone] }),
  };

  return <ActivityIndicator ref={ref} {...engineProps} />;
});

Spinner.displayName = 'Spinner';
