import { cn } from '@beeui/core';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { Text } from './text';

type SegmentedControlContextValue = {
  disabled: boolean;
  onValueChange?: (value: string) => void;
  value: string;
};

const SegmentedControlContext = React.createContext<SegmentedControlContextValue | null>(null);

function useSegmentedControlContext() {
  const context = React.useContext(SegmentedControlContext);
  if (!context) throw new Error('SegmentedControlItem must be rendered inside SegmentedControl.');
  return context;
}

export type SegmentedControlProps = Omit<ViewProps, 'children' | 'role'> & {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  value: string;
};

export const SegmentedControl = React.forwardRef<
  React.ComponentRef<typeof View>,
  SegmentedControlProps
>(({ children, className, disabled = false, onValueChange, value, ...props }, ref) => {
  const context = React.useMemo(
    () => ({ disabled, onValueChange, value }),
    [disabled, onValueChange, value],
  );

  return (
    <SegmentedControlContext.Provider value={context}>
      <View
        ref={ref}
        {...props}
        accessibilityRole="radiogroup"
        className={cn('flex-row rounded-md bg-muted p-1', className)}
      >
        {children}
      </View>
    </SegmentedControlContext.Provider>
  );
});

SegmentedControl.displayName = 'SegmentedControl';

export type SegmentedControlItemProps = Omit<
  PressableProps,
  'accessibilityRole' | 'children' | 'onPress' | 'role'
> & {
  children?: React.ReactNode;
  className?: string;
  labelClassName?: string;
  onPress?: PressableProps['onPress'];
  value: string;
};

export const SegmentedControlItem = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  SegmentedControlItemProps
>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      children,
      className,
      disabled = false,
      labelClassName,
      onPress,
      value,
      ...props
    },
    ref,
  ) => {
    const control = useSegmentedControlContext();
    const selected = control.value === value;
    const isDisabled = disabled || control.disabled;
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
        accessibilityRole="radio"
        accessibilityState={{ ...accessibilityState, checked: selected, disabled: isDisabled }}
        className={cn(
          'min-h-9 flex-1 items-center justify-center rounded-sm border px-3 py-2 active:opacity-80',
          selected
            ? 'border-border bg-surface-raised'
            : 'border-transparent bg-transparent web:hover:bg-surface-muted',
          isDisabled && 'opacity-50',
          className,
        )}
        disabled={isDisabled}
        onPress={(event) => {
          onPress?.(event);
          if (!selected) control.onValueChange?.(value);
        }}
      >
        {childArray.map((child, index) =>
          typeof child === 'string' || typeof child === 'number' ? (
            <Text
              key={`segmented-control-label-${index}`}
              className={cn(
                selected ? 'text-foreground' : 'text-muted-foreground',
                labelClassName,
              )}
              variant="label"
            >
              {child}
            </Text>
          ) : (
            child
          ),
        )}
      </Pressable>
    );
  },
);

SegmentedControlItem.displayName = 'SegmentedControlItem';
