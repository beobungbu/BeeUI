import { cn } from '@beeui/core';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import { Text } from './text';
import { useRequiredCallbackWarning } from './use-required-callback-warning';

const checkboxIndicatorVariants = cva(
  'h-5 w-5 shrink-0 items-center justify-center rounded-sm border',
  {
    variants: {
      state: {
        unchecked: 'border-border-strong bg-input',
        checked: 'border-primary bg-primary',
        indeterminate: 'border-primary bg-primary',
      },
      disabled: {
        true: 'border-disabled bg-disabled',
        false: '',
      },
    },
    defaultVariants: {
      state: 'unchecked',
      disabled: false,
    },
  },
);

export type CheckboxValue = boolean | 'indeterminate';

export type CheckboxProps = Omit<
  PressableProps,
  'accessibilityRole' | 'role' | 'children' | 'onPress'
> & {
  checked?: CheckboxValue;
  className?: string;
  indicatorClassName?: string;
  label?: string;
  labelClassName?: string;
  onCheckedChange?: (checked: boolean) => void;
};

export const Checkbox = React.forwardRef<React.ComponentRef<typeof Pressable>, CheckboxProps>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      checked = false,
      className,
      disabled = false,
      indicatorClassName,
      label,
      labelClassName,
      onCheckedChange,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled === true;
    const state = checked === 'indeterminate' ? 'indeterminate' : checked ? 'checked' : 'unchecked';
    const accessibilityChecked = checked === 'indeterminate' ? 'mixed' : checked;

    useRequiredCallbackWarning('Checkbox', 'onCheckedChange', onCheckedChange, isDisabled);

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="checkbox"
        accessibilityState={{
          ...accessibilityState,
          checked: accessibilityChecked,
          disabled: isDisabled,
        }}
        className={cn('flex-row items-center gap-3 active:opacity-80', className)}
        disabled={isDisabled}
        onPress={() => onCheckedChange?.(checked !== true)}
      >
        <View
          accessible={false}
          className={cn(
            checkboxIndicatorVariants({ disabled: isDisabled, state }),
            indicatorClassName,
          )}
          pointerEvents="none"
        >
          {checked === true ? (
            <Text
              className={cn(
                'text-xs font-bold text-primary-foreground',
                isDisabled && 'text-disabled-foreground',
              )}
            >
              ✓
            </Text>
          ) : null}
          {checked === 'indeterminate' ? (
            <Text
              className={cn(
                'text-sm font-bold leading-4 text-primary-foreground',
                isDisabled && 'text-disabled-foreground',
              )}
            >
              −
            </Text>
          ) : null}
        </View>
        {label ? (
          <Text
            className={cn(isDisabled && 'text-disabled-foreground', labelClassName)}
            variant="body"
          >
            {label}
          </Text>
        ) : null}
      </Pressable>
    );
  },
);

Checkbox.displayName = 'Checkbox';

export { checkboxIndicatorVariants };
