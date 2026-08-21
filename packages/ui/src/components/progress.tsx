import { cn } from '@beeui/core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

const progressVariants = cva('w-full overflow-hidden rounded-full bg-muted', {
  variants: {
    size: {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export type ProgressProps = Omit<ViewProps, 'children'> &
  VariantProps<typeof progressVariants> & {
    className?: string;
    indicatorClassName?: string;
    indicatorStyle?: StyleProp<ViewStyle>;
    max?: number;
    value: number;
  };

export const Progress = React.forwardRef<React.ComponentRef<typeof View>, ProgressProps>(
  (
    {
      accessibilityValue,
      className,
      indicatorClassName,
      indicatorStyle,
      max = 100,
      size,
      value,
      ...props
    },
    ref,
  ) => {
    const boundedMax = Number.isFinite(max) && max > 0 ? max : 100;
    const boundedValue = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), boundedMax);
    const percentage = (boundedValue / boundedMax) * 100;

    return (
      <View
        ref={ref}
        {...props}
        accessibilityRole="progressbar"
        accessibilityValue={{
          ...accessibilityValue,
          max: boundedMax,
          min: 0,
          now: boundedValue,
        }}
        className={cn(progressVariants({ size }), className)}
      >
        <View
          className={cn('h-full rounded-full bg-primary', indicatorClassName)}
          style={[{ width: `${percentage}%` }, indicatorStyle]}
        />
      </View>
    );
  },
);

Progress.displayName = 'Progress';

export { progressVariants };
