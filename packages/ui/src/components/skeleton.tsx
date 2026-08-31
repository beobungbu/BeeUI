import { cn } from '@beemvp/beeui-core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

const skeletonVariants = cva('bg-muted', {
  variants: {
    variant: {
      block: 'rounded-md',
      circle: 'aspect-square rounded-full',
      text: 'h-4 rounded-sm',
    },
  },
  defaultVariants: {
    variant: 'block',
  },
});

export type SkeletonProps = Omit<ViewProps, 'accessible' | 'aria-hidden'> &
  VariantProps<typeof skeletonVariants> & {
    className?: string;
  };

export const Skeleton = React.forwardRef<React.ComponentRef<typeof View>, SkeletonProps>(
  ({ className, variant, ...props }, ref) => (
    <View
      ref={ref}
      {...props}
      aria-hidden
      accessible={false}
      className={cn(skeletonVariants({ variant }), className)}
    />
  ),
);

Skeleton.displayName = 'Skeleton';

export { skeletonVariants };
