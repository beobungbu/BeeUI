import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

export type SeparatorProps = Omit<ViewProps, 'role'> & {
  className?: string;
  /** When true (the default), hides the separator from accessibility and omits `role="separator"`, since a purely visual divider should not be announced. Set to false for a separator that conveys real structure. */
  decorative?: boolean;
  /** `'horizontal'` renders a full-width 1px-tall line; `'vertical'` renders a self-stretching 1px-wide line. Defaults to `'horizontal'`. */
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
