import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { useFieldContext } from './field-context';
import { Text } from './text';
import { useRequiredCallbackWarning } from './use-required-callback-warning';

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
  /** Disables every `SegmentedControlItem` inside, overriding each item's own `disabled`. Defaults to false. */
  disabled?: boolean;
  /** Called with the newly selected item's `value` when a non-selected item is pressed. Required for enabled usage (logs a dev warning otherwise). */
  onValueChange?: (value: string) => void;
  /** The `value` of the currently selected `SegmentedControlItem`. Always controlled by the caller — there is no uncontrolled mode. */
  value: string;
};

export const SegmentedControl = React.forwardRef<
  React.ComponentRef<typeof View>,
  SegmentedControlProps
>(({ accessibilityLabel, accessibilityLabelledBy, children, className, disabled = false, onValueChange, value, ...props }, ref) => {
  useRequiredCallbackWarning('SegmentedControl', 'onValueChange', onValueChange, disabled);

  // The `radiogroup` previously had no accessible name at all (a screen
  // reader announced bare "radio group"). An explicit `accessibilityLabel`
  // always wins; absent that, falls back to the enclosing `Field`'s label the
  // same way `RadioGroup` already does.
  const field = useFieldContext();
  const resolvedAccessibilityLabelledBy = accessibilityLabelledBy ?? field?.labelNativeID;
  const resolvedAccessibilityLabel = accessibilityLabel ?? field?.label;

  const context = React.useMemo(
    () => ({ disabled, onValueChange, value }),
    [disabled, onValueChange, value],
  );

  return (
    <SegmentedControlContext.Provider value={context}>
      <View
        ref={ref}
        {...props}
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityLabelledBy={resolvedAccessibilityLabelledBy}
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
  /** Called before the item's own selection logic runs, regardless of whether this item is already selected. */
  onPress?: PressableProps['onPress'];
  /** Identifies this item; compared against the parent `SegmentedControl`'s `value` to determine whether it is selected. */
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
        // See Checkbox/Radio: `accessibilityState` is not forwarded to the DOM
        // by react-native-web, so `role="radio"` needs the web-native
        // `aria-checked` prop set explicitly to satisfy the required-attribute contract.
        aria-checked={selected}
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
                // A React Native flex item's default `flexShrink` is `0`
                // (unlike CSS Web's `1` — see Button's own `max-w-full` note), so
                // without an explicit width this label measures at its own
                // single-line intrinsic width and gets hard-clipped mid-glyph by
                // this item's `flex-1` bounds at large accessibility text sizes
                // instead of wrapping. `w-full` gives it the item's full
                // available width to wrap onto multiple lines within.
                'w-full text-center',
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
