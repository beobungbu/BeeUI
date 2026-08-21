import { cn } from '@beeui/core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type TextProps as RNTextProps,
} from 'react-native';
import { Text } from './text';

const buttonVariants = cva(
  'flex-row items-center justify-center gap-2 rounded-md border active:opacity-90',
  {
    variants: {
      variant: {
        primary:
          'border-primary bg-primary active:bg-primary-pressed web:hover:bg-primary-hover',
        secondary:
          'border-secondary bg-secondary active:opacity-80 web:hover:bg-secondary-hover',
        outline:
          'border-border-strong bg-surface active:bg-muted web:hover:bg-surface-muted',
        ghost: 'border-transparent bg-transparent active:bg-muted web:hover:bg-surface-muted',
        destructive:
          'border-destructive bg-destructive active:opacity-80 web:hover:opacity-90',
      },
      size: {
        sm: 'h-9 px-3',
        md: 'h-11 px-4',
        lg: 'h-12 px-5',
        icon: 'h-11 w-11 px-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

const buttonLabelVariants = cva('font-semibold', {
  variants: {
    variant: {
      primary: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      outline: 'text-foreground',
      ghost: 'text-foreground',
      destructive: 'text-destructive-foreground',
    },
    size: {
      sm: 'text-sm',
      md: 'text-sm',
      lg: 'text-base',
      icon: 'text-sm',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

export type ButtonProps = Omit<PressableProps, 'children'> &
  VariantProps<typeof buttonVariants> & {
    children?: React.ReactNode;
    className?: string;
    labelClassName?: string;
    loading?: boolean;
  };

export const Button = React.forwardRef<React.ComponentRef<typeof Pressable>, ButtonProps>(
  (
    {
      children,
      className,
      disabled,
      labelClassName,
      loading = false,
      size,
      variant,
      accessibilityLabel,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const isTextChild = typeof children === 'string' || typeof children === 'number';

    return (
      <Pressable
        ref={ref}
        accessibilityLabel={accessibilityLabel ?? (isTextChild ? String(children) : undefined)}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        className={cn(
          buttonVariants({ variant, size }),
          isDisabled && 'border-disabled bg-disabled opacity-60',
          className,
        )}
        disabled={isDisabled}
        {...props}
      >
        {loading ? <ActivityIndicator size="small" /> : null}
        {isTextChild ? (
          <Text
            className={cn(
              buttonLabelVariants({ variant, size }),
              isDisabled && 'text-disabled-foreground',
              labelClassName,
            )}
            variant="label"
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    );
  },
);

Button.displayName = 'Button';

export type ButtonLabelProps = RNTextProps &
  VariantProps<typeof buttonLabelVariants> & {
    className?: string;
  };

export function ButtonLabel({ className, size, variant, ...props }: ButtonLabelProps) {
  return (
    <Text className={cn(buttonLabelVariants({ variant, size }), className)} variant="label" {...props} />
  );
}

export { buttonLabelVariants, buttonVariants };
