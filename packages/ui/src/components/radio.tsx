import { cn } from '@beeui/core';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { useControllableState } from '../hooks/use-controllable-state';
import { useFieldContext } from './field-context';
import { Text } from './text';

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
      invalid: {
        true: 'border-destructive',
        false: '',
      },
    },
    defaultVariants: {
      checked: false,
      disabled: false,
      invalid: false,
    },
  },
);

type RadioGroupContextValue = {
  disabled: boolean;
  select: (value: string) => void;
  value: string;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

export type RadioGroupProps = Omit<ViewProps, 'accessibilityRole' | 'role' | 'children'> & {
  children?: React.ReactNode;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  value?: string;
};

export const RadioGroup = React.forwardRef<React.ComponentRef<typeof View>, RadioGroupProps>(
  (
    {
      children,
      className,
      defaultValue = '',
      disabled = false,
      onValueChange,
      value,
      ...props
    },
    ref,
  ) => {
    const [resolvedValue, setValue] = useControllableState({
      defaultValue,
      disabled,
      name: 'RadioGroup',
      onChange: onValueChange,
      value,
    });
    const contextValue = React.useMemo(
      () => ({ disabled, select: setValue, value: resolvedValue }),
      [disabled, resolvedValue, setValue],
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
  defaultChecked?: boolean;
  indicatorClassName?: string;
  invalid?: boolean;
  label?: string;
  labelClassName?: string;
  onCheckedChange?: (checked: boolean) => void;
  value?: string;
};

export const Radio = React.forwardRef<React.ComponentRef<typeof Pressable>, RadioProps>(
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
      value,
      ...props
    },
    ref,
  ) => {
    const field = useFieldContext();
    const group = React.useContext(RadioGroupContext);
    const inGroup = group !== null;
    const malformedGroupItem = inGroup && value === undefined;
    const resolvedDisabled = disabled === true || group?.disabled === true || field?.disabled === true || malformedGroupItem;
    const resolvedInvalid = invalid === true || field?.invalid === true;
    const [standaloneChecked, setStandaloneChecked] = useControllableState({
      defaultValue: defaultChecked,
      disabled: resolvedDisabled,
      name: 'Radio',
      onChange: onCheckedChange,
      value: checked,
    });
    const resolvedChecked = inGroup && value !== undefined ? group.value === value : standaloneChecked;
    const fieldLabel = field
      ? field.required
        ? `${field.label}, ${field.requiredAccessibilityLabel}`
        : field.label
      : undefined;
    const resolvedHint =
      accessibilityHint ?? (resolvedInvalid ? field?.error : field?.description);

    React.useEffect(() => {
      if (typeof __DEV__ !== 'undefined' && __DEV__ && malformedGroupItem) {
        console.warn('BeeUI Radio: a Radio rendered inside RadioGroup requires a `value`.');
      }
    }, [malformedGroupItem]);

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityHint={resolvedHint}
        accessibilityLabel={accessibilityLabel ?? label ?? fieldLabel}
        accessibilityLabelledBy={accessibilityLabelledBy ?? (label ? undefined : field?.labelNativeID)}
        accessibilityRole="radio"
        accessibilityState={{
          ...accessibilityState,
          checked: resolvedChecked,
          disabled: resolvedDisabled,
        }}
        className={cn('flex-row items-center gap-3 active:opacity-80', className)}
        disabled={resolvedDisabled}
        onPress={() => {
          // A selected radio remains selected; deselection belongs to choosing another radio.
          if (resolvedChecked) return;
          if (inGroup && value !== undefined) {
            group.select(value);
            return;
          }
          setStandaloneChecked(true);
        }}
      >
        <View
          accessible={false}
          className={cn(
            radioIndicatorVariants({
              checked: resolvedChecked,
              disabled: resolvedDisabled,
              invalid: resolvedInvalid,
            }),
            indicatorClassName,
          )}
          pointerEvents="none"
        >
          {resolvedChecked ? (
            <View
              className={cn(
                'h-2.5 w-2.5 rounded-full bg-primary',
                resolvedDisabled && 'bg-disabled-foreground',
              )}
            />
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

Radio.displayName = 'Radio';

export { radioIndicatorVariants };
