import { cn } from '@beeui/core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

const semanticTypographyClasses = {
  display:
    'text-[length:var(--text-display)] leading-[var(--text-display--line-height)]',
  title: 'text-[length:var(--text-title)] leading-[var(--text-title--line-height)]',
  heading:
    'text-[length:var(--text-heading)] leading-[var(--text-heading--line-height)]',
  body: 'text-[length:var(--text-body)] leading-[var(--text-body--line-height)]',
  label: 'text-[length:var(--text-label)] leading-[var(--text-label--line-height)]',
  caption:
    'text-[length:var(--text-caption)] leading-[var(--text-caption--line-height)]',
} as const;

const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      display: `${semanticTypographyClasses.display} font-bold tracking-tight`,
      title: `${semanticTypographyClasses.title} font-bold`,
      heading: `${semanticTypographyClasses.heading} font-semibold`,
      body: semanticTypographyClasses.body,
      label: `${semanticTypographyClasses.label} font-semibold`,
      caption: `${semanticTypographyClasses.caption} text-muted-foreground`,
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

export { semanticTypographyClasses, textVariants };
