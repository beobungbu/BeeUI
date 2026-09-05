import { cn } from '@beemvp/beeui-core';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { useFormGroupContext } from './form-group-context';
import { Text } from './text';
import { useRequiredCallbackWarning } from './use-required-callback-warning';

const radioIndicatorVariants = cva(
  'h-5 w-5 shrink-0 items-center justify-center rounded-full border',
  {
    variants: {
      checked: {
        true: 'border-primary bg-input',
        false: 'border-border-strong bg-input',
      },
      disabled: {
        true: 'border-disabled bg-disabled',
        false: '',
      },
    },
    defaultVariants: {
      checked: false,
      disabled: false,
    },
  },
);

type RadioGroupContextValue = {
  disabled: boolean;
  onValueChange?: (value: string) => void;
  value?: string;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

export type RadioGroupProps = Omit<ViewProps, 'accessibilityRole' | 'role' | 'children'> & {
  children?: React.ReactNode;
  className?: string;
  /** Disables every `Radio` inside the group. Combined with (not overridden by) the enclosing `FormGroup`'s own `disabled`. Defaults to false. */
  disabled?: boolean;
  /** Called with the selected `Radio`'s `value` when the selection changes. Required for enabled usage (logs a dev warning otherwise). */
  onValueChange?: (value: string) => void;
  /** The `value` of the currently selected `Radio` among this group's children. */
  value?: string;
};

export const RadioGroup = React.forwardRef<React.ComponentRef<typeof View>, RadioGroupProps>(
  (
    {
      accessibilityHint,
      accessibilityLabel,
      accessibilityLabelledBy,
      accessibilityState,
      children,
      className,
      disabled = false,
      onValueChange,
      value,
      ...props
    },
    ref,
  ) => {
    const formGroup = useFormGroupContext();
    const resolvedDisabled = disabled || formGroup?.disabled === true;
    const inheritedHint =
      formGroup?.invalid && formGroup.error ? formGroup.error : formGroup?.description;
    const resolvedLabelledBy =
      accessibilityLabelledBy ??
      (accessibilityLabel === undefined ? formGroup?.legendNativeID : undefined);

    useRequiredCallbackWarning('RadioGroup', 'onValueChange', onValueChange, resolvedDisabled);

    const contextValue = React.useMemo(
      () => ({ disabled: resolvedDisabled, onValueChange, value }),
      [onValueChange, resolvedDisabled, value],
    );

    return (
      <RadioGroupContext.Provider value={contextValue}>
        <View
          ref={ref}
          {...props}
          accessibilityHint={accessibilityHint ?? inheritedHint}
          accessibilityLabel={accessibilityLabel ?? formGroup?.legendAccessibilityLabel}
          accessibilityLabelledBy={resolvedLabelledBy}
          accessibilityRole="radiogroup"
          accessibilityState={{ ...accessibilityState, disabled: resolvedDisabled }}
          className={cn('gap-2', className)}
        >
          {children}
        </View>
      </RadioGroupContext.Provider>
    );
  },
);

RadioGroup.displayName = 'RadioGroup';

export type RadioProps = Omit<
  PressableProps,
  'accessibilityRole' | 'role' | 'children' | 'onPress'
> & {
  /** Whether this Radio is checked when it is standalone (not inside a `RadioGroup`). Ignored inside a `RadioGroup`, which derives checked state by comparing `value` to the group's selection. Defaults to false. */
  checked?: boolean;
  className?: string;
  /** Applied to the radio's own circle, not its label. */
  indicatorClassName?: string;
  label?: string;
  labelClassName?: string;
  /** Called with the next checked state when pressed, if this Radio is standalone (not inside a `RadioGroup`). Required for enabled standalone usage (logs a dev warning otherwise). */
  onCheckedChange?: (checked: boolean) => void;
  /** Identifies this Radio within a parent `RadioGroup`; required there for the item to participate in selection. Has no effect on a standalone Radio. */
  value?: string;
};

export const Radio = React.forwardRef<React.ComponentRef<typeof Pressable>, RadioProps>(
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
      value,
      ...props
    },
    ref,
  ) => {
    const group = React.useContext(RadioGroupContext);
    const isGrouped = group !== null && value !== undefined;
    const resolvedChecked = isGrouped ? group.value === value : checked;
    const isDisabled = disabled === true || group?.disabled === true;

    useRequiredCallbackWarning('Radio', 'onCheckedChange', onCheckedChange, isDisabled || isGrouped);

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="radio"
        accessibilityState={{
          ...accessibilityState,
          checked: resolvedChecked,
          disabled: isDisabled,
        }}
        // See Checkbox: `accessibilityState` is not forwarded to the DOM by
        // react-native-web, so `role="radio"` needs the web-native `aria-checked`
        // prop set explicitly to satisfy the required-attribute contract.
        aria-checked={resolvedChecked}
        className={cn('flex-row items-center gap-3 active:opacity-80', className)}
        disabled={isDisabled}
        onPress={() => {
          if (isGrouped && value !== undefined) {
            if (!resolvedChecked) group?.onValueChange?.(value);
            return;
          }

          onCheckedChange?.(!resolvedChecked);
        }}
      >
        <View
          accessible={false}
          className={cn(
            radioIndicatorVariants({ checked: resolvedChecked, disabled: isDisabled }),
            indicatorClassName,
          )}
          pointerEvents="none"
        >
          {resolvedChecked ? (
            <View
              className={cn(
                'h-2.5 w-2.5 rounded-full bg-primary',
                isDisabled && 'bg-disabled-foreground',
              )}
            />
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

Radio.displayName = 'Radio';

export { radioIndicatorVariants };
