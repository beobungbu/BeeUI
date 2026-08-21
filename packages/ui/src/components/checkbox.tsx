import { cn } from '@beeui/core';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import { useControllableState } from '../hooks/use-controllable-state';
import { useFieldContext } from './field-context';
import { Text } from './text';

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
      invalid: {
        true: 'border-destructive',
        false: '',
      },
    },
    defaultVariants: {
      state: 'unchecked',
      disabled: false,
      invalid: false,
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
  defaultChecked?: CheckboxValue;
  indicatorClassName?: string;
  invalid?: boolean;
  label?: string;
  labelClassName?: string;
  onCheckedChange?: (checked: boolean) => void;
};

export const Checkbox = React.forwardRef<React.ComponentRef<typeof Pressable>, CheckboxProps>(
  (
    {
      accessibilityHint,
      accessibilityLabel,
      accessibilityLabelledBy,
      accessibilityState,
      checked,
      className,
      defaultChecked = false,
      disabled = false,
      indicatorClassName,
      invalid,
      label,
      labelClassName,
      onCheckedChange,
      ...props
    },
    ref,
  ) => {
    const field = useFieldContext();
    const resolvedDisabled = disabled === true || field?.disabled === true;
    const resolvedInvalid = invalid === true || field?.invalid === true;
    const [resolvedChecked, setChecked] = useControllableState<CheckboxValue>({
      defaultValue: defaultChecked,
      disabled: resolvedDisabled,
      name: 'Checkbox',
      onChange: (next) => onCheckedChange?.(next === true),
      value: checked,
    });
    const state =
      resolvedChecked === 'indeterminate'
        ? 'indeterminate'
        : resolvedChecked
          ? 'checked'
          : 'unchecked';
    const accessibilityChecked =
      resolvedChecked === 'indeterminate' ? 'mixed' : resolvedChecked;
    const fieldLabel = field
      ? field.required
        ? `${field.label}, ${field.requiredAccessibilityLabel}`
        : field.label
      : undefined;
    const resolvedHint =
      accessibilityHint ?? (resolvedInvalid ? field?.error : field?.description);

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityHint={resolvedHint}
        accessibilityLabel={accessibilityLabel ?? label ?? fieldLabel}
        accessibilityLabelledBy={accessibilityLabelledBy ?? (label ? undefined : field?.labelNativeID)}
        accessibilityRole="checkbox"
        accessibilityState={{
          ...accessibilityState,
          checked: accessibilityChecked,
          disabled: resolvedDisabled,
        }}
        className={cn('flex-row items-center gap-3 active:opacity-80', className)}
        disabled={resolvedDisabled}
        onPress={() => setChecked((previous) => previous !== true)}
      >
        <View
          accessible={false}
          className={cn(
            checkboxIndicatorVariants({
              disabled: resolvedDisabled,
              invalid: resolvedInvalid,
              state,
            }),
            indicatorClassName,
          )}
          pointerEvents="none"
        >
          {resolvedChecked === true ? (
            <Text
              className={cn(
                'text-xs font-bold text-primary-foreground',
                resolvedDisabled && 'text-disabled-foreground',
              )}
            >
              ✓
            </Text>
          ) : null}
          {resolvedChecked === 'indeterminate' ? (
            <Text
              className={cn(
                'text-sm font-bold leading-4 text-primary-foreground',
                resolvedDisabled && 'text-disabled-foreground',
              )}
            >
              −
            </Text>
          ) : null}
        </View>
        {label ? (
          <Text
            className={cn(resolvedDisabled && 'text-disabled-foreground', labelClassName)}
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
