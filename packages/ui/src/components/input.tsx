import { cn } from '@beeui/core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';

const inputVariants = cva(
  'w-full rounded-md border bg-input text-foreground focus:border-focus-ring',
  {
    variants: {
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-3 text-base',
        lg: 'h-12 px-4 text-base',
      },
      invalid: {
        true: 'border-destructive focus:border-destructive',
        false: 'border-border-strong',
      },
    },
    defaultVariants: {
      size: 'md',
      invalid: false,
    },
  },
);

export type InputProps = TextInputProps &
  Omit<VariantProps<typeof inputVariants>, 'invalid'> & {
    className?: string;
    disabled?: boolean;
    invalid?: boolean;
  };

export const Input = React.forwardRef<React.ComponentRef<typeof TextInput>, InputProps>(
  ({ className, disabled = false, editable, invalid = false, size, ...props }, ref) => (
    <TextInput
      ref={ref}
      accessibilityState={{ disabled }}
      className={cn(
        inputVariants({ invalid, size }),
        disabled && 'border-disabled bg-disabled text-disabled-foreground opacity-70',
        className,
      )}
      editable={!disabled && editable !== false}
      {...props}
    />
  ),
);

Input.displayName = 'Input';

export { inputVariants };
