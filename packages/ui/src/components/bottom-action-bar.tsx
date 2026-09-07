import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

export type BottomActionBarProps = ViewProps & {
  /** Renders a top border separating the bar from the content above. Defaults to true. */
  bordered?: boolean;
  className?: string;
};

export const BottomActionBar = React.forwardRef<
  React.ComponentRef<typeof View>,
  BottomActionBarProps
>(({ bordered = true, className, ...props }, ref) => (
  <View
    ref={ref}
    className={cn(
      'w-full flex-row items-center justify-end gap-3 bg-surface px-4 py-3',
      bordered && 'border-t border-border',
      className,
    )}
    {...props}
  />
));

BottomActionBar.displayName = 'BottomActionBar';
