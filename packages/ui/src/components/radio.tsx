import { cn } from '@beeui/core';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
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
    },
    defaultVariants: {
      checked: false,
      disabled: false,
    },
  },
);

export type RadioProps = Omit<PressableProps, 'children' | 'onPress'> & {
  checked?: boolean;
  className?: string;
  indicatorClassName?: string;
  label?: string;
  labelClassName?: string;
  onCheckedChange?: (checked: boolean) => void;
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
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled === true;

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="radio"
        accessibilityState={{
          ...accessibilityState,
          checked,
          disabled: isDisabled,
        }}
        className={cn('flex-row items-center gap-3 active:opacity-80', className)}
        disabled={isDisabled}
        onPress={() => {
          if (!checked) {
            onCheckedChange?.(true);
          }
        }}
      >
        <View
          accessible={false}
          className={cn(
            radioIndicatorVariants({ checked, disabled: isDisabled }),
            indicatorClassName,
          )}
          pointerEvents="none"
        >
          {checked ? (
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
