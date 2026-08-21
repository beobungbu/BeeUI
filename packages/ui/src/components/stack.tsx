import { cn } from '@beeui/core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

export const stackVariants = cva('', {
  variants: {
    direction: {
      horizontal: 'flex-row',
      vertical: 'flex-col',
    },
    gap: {
      none: 'gap-0',
      xs: 'gap-1',
      sm: 'gap-2',
      md: 'gap-3',
      lg: 'gap-4',
      xl: 'gap-6',
    },
    align: {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
    },
    justify: {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
      evenly: 'justify-evenly',
    },
    wrap: {
      true: 'flex-wrap',
      false: 'flex-nowrap',
    },
  },
  defaultVariants: {
    direction: 'vertical',
    gap: 'md',
    align: 'stretch',
    justify: 'start',
    wrap: false,
  },
});

export type StackProps = ViewProps &
  VariantProps<typeof stackVariants> & {
    className?: string;
  };

export const Stack = React.forwardRef<React.ComponentRef<typeof View>, StackProps>(
  ({ align, className, direction, gap, justify, wrap, ...props }, ref) => (
    <View
      ref={ref}
      className={cn(stackVariants({ align, direction, gap, justify, wrap }), className)}
      {...props}
    />
  ),
);

Stack.displayName = 'Stack';

export type HStackProps = Omit<StackProps, 'direction'>;

export const HStack = React.forwardRef<React.ComponentRef<typeof View>, HStackProps>(
  ({ align = 'center', ...props }, ref) => (
    <Stack ref={ref} align={align} direction="horizontal" {...props} />
  ),
);

HStack.displayName = 'HStack';

export type VStackProps = Omit<StackProps, 'direction'>;

export const VStack = React.forwardRef<React.ComponentRef<typeof View>, VStackProps>(
  (props, ref) => <Stack ref={ref} direction="vertical" {...props} />,
);

VStack.displayName = 'VStack';
