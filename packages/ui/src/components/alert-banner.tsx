import { cn } from '@beeui/core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { Box } from './box';
import { Text, type TextProps } from './text';

const alertBannerVariants = cva('w-full rounded-md border bg-surface p-4', {
  variants: {
    variant: {
      neutral: 'border-border-strong',
      info: 'border-info',
      success: 'border-success',
      warning: 'border-warning',
      destructive: 'border-destructive',
    },
  },
  defaultVariants: {
    variant: 'neutral',
  },
});

type AlertBannerVariant = NonNullable<VariantProps<typeof alertBannerVariants>['variant']>;
type AlertTone = NonNullable<TextProps['tone']>;

const titleToneByVariant: Record<AlertBannerVariant, AlertTone> = {
  neutral: 'default',
  info: 'info',
  success: 'success',
  warning: 'warning',
  destructive: 'destructive',
};

export type AlertBannerProps = Omit<ViewProps, 'children'> &
  VariantProps<typeof alertBannerVariants> & {
    action?: React.ReactNode;
    className?: string;
    description?: React.ReactNode;
    live?: 'none' | 'polite' | 'assertive';
    title: React.ReactNode;
  };

export const AlertBanner = React.forwardRef<React.ComponentRef<typeof View>, AlertBannerProps>(
  (
    {
      action,
      className,
      description,
      live = 'polite',
      title,
      variant,
      ...props
    },
    ref,
  ) => {
    const resolvedVariant: AlertBannerVariant = variant ?? 'neutral';

    return (
      <View
        ref={ref}
        accessibilityLiveRegion={live}
        className={cn(alertBannerVariants({ variant: resolvedVariant }), className)}
        {...props}
      >
        <Box className="gap-2">
          {typeof title === 'string' || typeof title === 'number' ? (
            <Text tone={titleToneByVariant[resolvedVariant]} variant="label">{title}</Text>
          ) : (
            title
          )}
          {description ? (
            typeof description === 'string' || typeof description === 'number' ? (
              <Text tone="muted" variant="caption">{description}</Text>
            ) : (
              description
            )
          ) : null}
          {action ? <Box className="pt-1">{action}</Box> : null}
        </Box>
      </View>
    );
  },
);

AlertBanner.displayName = 'AlertBanner';

export { alertBannerVariants };
