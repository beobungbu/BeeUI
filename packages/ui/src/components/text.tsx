import { cn } from '@beeui/core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      body: 'text-base leading-6',
      label: 'text-sm font-semibold leading-5',
      caption: 'text-xs leading-4 text-muted-foreground',
      title: 'text-2xl font-bold leading-8',
      heading: 'text-lg font-semibold leading-6',
    },
    tone: {
      default: '',
      muted: 'text-muted-foreground',
      subtle: 'text-subtle-foreground',
      primary: 'text-primary',
      destructive: 'text-destructive',
      success: 'text-success',
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
