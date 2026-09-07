import { cn } from '@beemvp/beeui-core';
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

export type ProgressProps = Omit<ViewProps, 'accessibilityRole' | 'role' | 'children'> &
  VariantProps<typeof progressVariants> & {
    className?: string;
    /** Applied to the filled indicator bar, not the track. */
    indicatorClassName?: string;
    /** Applied to the filled indicator bar, alongside the computed `width` style; not the track. */
    indicatorStyle?: StyleProp<ViewStyle>;
    /** Upper bound `value` is measured against to compute the filled percentage. Non-finite or non-positive values fall back to 100. The accessible minimum is always 0 — there is no `min` prop. Defaults to 100. */
    max?: number;
    /** Current progress, clamped to `[0, max]`; a non-finite value is treated as 0. */
    value: number;
  };

export const Progress = React.forwardRef<React.ComponentRef<typeof View>, ProgressProps>(
  (
    {
      accessibilityLabel,
      accessibilityLabelledBy,
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
    // A progressbar always needs an accessible name (WAI-ARIA `accessibleNameRequired`).
    // Fall back to a generic, non-brand default only when the caller hasn't supplied
    // either an explicit label or a labelledby relationship of their own.
    const resolvedAccessibilityLabel =
      accessibilityLabel ?? (accessibilityLabelledBy ? undefined : 'Progress');

    return (
      <View
        ref={ref}
        {...props}
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityLabelledBy={accessibilityLabelledBy}
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
