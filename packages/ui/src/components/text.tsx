import { cn } from '@beeui/core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      display: 'text-display font-bold tracking-tight',
      title: 'text-title font-bold tracking-tight',
      heading: 'text-heading font-semibold',
      body: 'text-body',
      label: 'text-label font-semibold',
      caption: 'text-caption text-muted-foreground',
    },
    tone: {
      default: '',
      muted: 'text-muted-foreground',
      subtle: 'text-subtle-foreground',
      primary: 'text-primary',
      destructive: 'text-destructive',
      success: 'text-success',
      warning: 'text-warning',
      info: 'text-info',
    },
  },
  defaultVariants: {
    variant: 'body',
    tone: 'default',
  },
});

export type TextProps = RNTextProps &
  VariantProps<typeof textVariants> & {
    className?: string;
  };

export const Text = React.forwardRef<React.ComponentRef<typeof RNText>, TextProps>(
  ({ className, variant, tone, ...props }, ref) => (
    <RNText ref={ref} className={cn(textVariants({ variant, tone }), className)} {...props} />
  ),
);

Text.displayName = 'Text';

export { textVariants };
