import * as React from 'react';
import {
  ActivityIndicator,
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

export type SpinnerProps = Omit<ActivityIndicatorProps, 'color'> & {
  className?: string;
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
    colorClassName: spinnerToneClasses[tone],
  };

  return <ActivityIndicator ref={ref} {...engineProps} />;
});

Spinner.displayName = 'Spinner';
