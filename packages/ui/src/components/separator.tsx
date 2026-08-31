import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

export type SeparatorProps = Omit<ViewProps, 'role'> & {
  className?: string;
  decorative?: boolean;
  orientation?: 'horizontal' | 'vertical';
};

export const Separator = React.forwardRef<React.ComponentRef<typeof View>, SeparatorProps>(
  ({ className, decorative = true, orientation = 'horizontal', ...props }, ref) => (
    <View
      ref={ref}
      {...props}
      accessible={decorative ? false : props.accessible}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'self-stretch w-px',
        className,
      )}
      role={decorative ? undefined : 'separator'}
    />
  ),
);

Separator.displayName = 'Separator';
