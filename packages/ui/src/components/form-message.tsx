import { cn } from '@beeui/core';
import * as React from 'react';
import { Text, type TextProps } from './text';

export type HelperTextProps = Omit<TextProps, 'tone' | 'variant'> & {
  className?: string;
};

export const HelperText = React.forwardRef<React.ComponentRef<typeof Text>, HelperTextProps>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} {...props} className={className} tone="muted" variant="caption" />
  ),
);

HelperText.displayName = 'HelperText';

export type FormMessageProps = Omit<TextProps, 'tone' | 'variant'> & {
  className?: string;
};

export const FormMessage = React.forwardRef<React.ComponentRef<typeof Text>, FormMessageProps>(
  ({ accessibilityLiveRegion = 'polite', className, ...props }, ref) => (
    <Text
      ref={ref}
      {...props}
      accessibilityLiveRegion={accessibilityLiveRegion}
      className={cn('font-medium', className)}
      tone="destructive"
      variant="caption"
    />
  ),
);

FormMessage.displayName = 'FormMessage';
