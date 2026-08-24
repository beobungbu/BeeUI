import { cn } from '@beeui/core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type ActivityIndicatorProps,
  type PressableProps,
  type TextProps as RNTextProps,
} from 'react-native';
import { Text } from './text';

const buttonVariants = cva(
  'flex-row items-center justify-center gap-2 rounded-md border active:opacity-90 web:focus-visible:bee-focus-ring',
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
        sm: 'h-control-compact px-3 ios:min-h-touch-target android:min-h-touch-target',
        md: 'h-control-default px-4',
        lg: 'h-control-large px-5',
        icon: 'h-control-icon w-control-icon px-0',
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
      sm: 'text-label',
      md: 'text-label',
      lg: 'text-body',
      icon: 'text-label',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;

type EngineActivityIndicatorProps = ActivityIndicatorProps & {
  colorClassName?: string;
};

const EngineActivityIndicator = ActivityIndicator as React.ComponentType<EngineActivityIndicatorProps>;

const spinnerColorByVariant: Record<ButtonVariant, string> = {
  primary: 'accent-primary-foreground',
  secondary: 'accent-secondary-foreground',
  outline: 'accent-foreground',
  ghost: 'accent-foreground',
  destructive: 'accent-destructive-foreground',
};

export type ButtonProps = Omit<PressableProps, 'accessibilityRole' | 'role' | 'children'> &
  VariantProps<typeof buttonVariants> & {
    children?: React.ReactNode;
    className?: string;
    labelClassName?: string;
    loading?: boolean;
  };

export const Button = React.forwardRef<React.ComponentRef<typeof Pressable>, ButtonProps>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      children,
      className,
      disabled,
      labelClassName,
      loading = false,
      size,
      variant,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const resolvedVariant: ButtonVariant = variant ?? 'primary';
    const childArray = React.Children.toArray(children);
    const inferredLabel = childArray.every(
      (child) => typeof child === 'string' || typeof child === 'number',
    )
      ? childArray.map(String).join('')
      : undefined;

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? inferredLabel}
        accessibilityRole="button"
        accessibilityState={{
          ...accessibilityState,
          disabled: isDisabled,
          busy: loading,
        }}
        className={cn(
          buttonVariants({ variant: resolvedVariant, size }),
          isDisabled && 'border-disabled bg-disabled opacity-60',
          className,
        )}
        disabled={isDisabled}
      >
        {loading ? (
          <EngineActivityIndicator
            colorClassName={spinnerColorByVariant[resolvedVariant]}
            size="small"
          />
        ) : null}
        {childArray.map((child, index) => {
          if (typeof child === 'string' || typeof child === 'number') {
            return (
              <Text
                key={`button-label-${index}`}
                className={cn(
                  buttonLabelVariants({ variant: resolvedVariant, size }),
                  isDisabled && 'text-disabled-foreground',
                  labelClassName,
                )}
                variant="label"
              >
                {child}
              </Text>
            );
          }

          return child;
        })}
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
