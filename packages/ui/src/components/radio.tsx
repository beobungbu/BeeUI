import { cn } from '@beeui/core';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
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
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  value?: string;
};

export const RadioGroup = React.forwardRef<React.ComponentRef<typeof View>, RadioGroupProps>(
  (
    {
      children,
      className,
      disabled = false,
      onValueChange,
      value,
      ...props
    },
    ref,
  ) => {
    useRequiredCallbackWarning('RadioGroup', 'onValueChange', onValueChange, disabled);

    const contextValue = React.useMemo(
      () => ({ disabled, onValueChange, value }),
      [disabled, onValueChange, value],
    );

    return (
      <RadioGroupContext.Provider value={contextValue}>
        <View
          ref={ref}
          {...props}
          accessibilityRole="radiogroup"
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
  checked?: boolean;
  className?: string;
  indicatorClassName?: string;
  label?: string;
  labelClassName?: string;
  onCheckedChange?: (checked: boolean) => void;
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
