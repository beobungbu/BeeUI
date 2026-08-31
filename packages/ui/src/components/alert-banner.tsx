import { cn } from '@beemvp/beeui-core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { AccessibilityInfo, Platform, View, type ViewProps } from 'react-native';
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

function getPrimitiveAnnouncement(...values: React.ReactNode[]) {
  if (
    !values.every(
      (value) => value == null || typeof value === 'string' || typeof value === 'number',
    )
  ) {
    return undefined;
  }

  const parts = values
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .map(String)
    .filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : undefined;
}

export type AlertBannerProps = Omit<ViewProps, 'children'> &
  VariantProps<typeof alertBannerVariants> & {
    action?: React.ReactNode;
    announcement?: string;
    className?: string;
    description?: React.ReactNode;
    live?: 'none' | 'polite' | 'assertive';
    title: React.ReactNode;
  };

export const AlertBanner = React.forwardRef<React.ComponentRef<typeof View>, AlertBannerProps>(
  (
    {
      action,
      announcement,
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
    const resolvedAnnouncement = announcement ?? getPrimitiveAnnouncement(title, description);

    React.useEffect(() => {
      if (Platform.OS !== 'ios' || live === 'none' || !resolvedAnnouncement) return;

      AccessibilityInfo.announceForAccessibilityWithOptions(resolvedAnnouncement, {
        queue: live === 'polite',
      });
    }, [live, resolvedAnnouncement]);

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
