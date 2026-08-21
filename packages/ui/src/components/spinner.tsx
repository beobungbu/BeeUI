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
>(({ tone = 'primary', ...props }, ref) => {
  const engineProps: EngineActivityIndicatorProps = {
    ...props,
    colorClassName: spinnerToneClasses[tone],
  };

  return <ActivityIndicator ref={ref} {...engineProps} />;
});

Spinner.displayName = 'Spinner';
