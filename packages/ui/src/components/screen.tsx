import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

const paddingClasses = {
  none: '',
  sm: 'px-3 py-3',
  md: 'px-5 py-5',
  lg: 'px-6 py-8',
} as const;

export type ScreenProps = ViewProps & {
  className?: string;
  /** Preset horizontal/vertical padding: `'none'` (0), `'sm'`, `'md'`, or `'lg'`. Defaults to `'none'`. */
  padding?: keyof typeof paddingClasses;
};

export const Screen = React.forwardRef<React.ComponentRef<typeof View>, ScreenProps>(
  ({ className, padding = 'none', ...props }, ref) => (
    <View
      ref={ref}
      className={cn('flex-1 bg-background', paddingClasses[padding], className)}
      {...props}
    />
  ),
);

Screen.displayName = 'Screen';
