import { cn } from '@beeui/core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { Text } from './text';

const badgeVariants = cva(
  'self-start flex-row items-center gap-1 rounded-full border px-2.5 py-1',
  {
    variants: {
      variant: {
        primary: 'border-primary bg-primary',
        secondary: 'border-secondary bg-secondary',
        success: 'border-success bg-success',
        warning: 'border-warning bg-warning',
        destructive: 'border-destructive bg-destructive',
        info: 'border-info bg-info',
        outline: 'border-border-strong bg-surface',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
);

const badgeLabelVariants = cva('text-xs font-semibold leading-4', {
  variants: {
    variant: {
      primary: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      success: 'text-success-foreground',
      warning: 'text-warning-foreground',
      destructive: 'text-destructive-foreground',
      info: 'text-info-foreground',
      outline: 'text-foreground',
    },
  },
  defaultVariants: {
    variant: 'primary',
  },
});

export type BadgeProps = Omit<ViewProps, 'children'> &
  VariantProps<typeof badgeVariants> & {
    children?: React.ReactNode;
    className?: string;
    labelClassName?: string;
  };

export const Badge = React.forwardRef<React.ComponentRef<typeof View>, BadgeProps>(
  ({ children, className, labelClassName, variant, ...props }, ref) => {
    const childArray = React.Children.toArray(children);

    return (
      <View ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
        {childArray.map((child, index) =>
          typeof child === 'string' || typeof child === 'number' ? (
            <Text
              key={`badge-label-${index}`}
              className={cn(badgeLabelVariants({ variant }), labelClassName)}
              variant="caption"
            >
              {child}
            </Text>
          ) : (
            child
          ),
        )}
      </View>
    );
  },
);

Badge.displayName = 'Badge';

export { badgeLabelVariants, badgeVariants };
