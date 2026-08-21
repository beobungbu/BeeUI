import { cn } from '@beeui/core';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { Text } from './text';

export type ChipSelectionMode = 'single' | 'multiple';
export type ChipGroupValue = string | string[];

type ChipGroupContextValue = {
  disabled: boolean;
  isSelected: (value: string) => boolean;
  selectionMode: ChipSelectionMode;
  select: (value: string) => void;
};

const ChipGroupContext = React.createContext<ChipGroupContextValue | null>(null);

export type ChipGroupProps = Omit<ViewProps, 'children'> & {
  children?: React.ReactNode;
  className?: string;
  defaultValue?: ChipGroupValue;
  disabled?: boolean;
  onValueChange?: (value: ChipGroupValue) => void;
  selectionMode?: ChipSelectionMode;
  value?: ChipGroupValue;
};

export const ChipGroup = React.forwardRef<React.ComponentRef<typeof View>, ChipGroupProps>(
  (
    {
      children,
      className,
      defaultValue,
      disabled = false,
      onValueChange,
      selectionMode = 'single',
      value,
      ...props
    },
    ref,
  ) => {
    const controlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState<ChipGroupValue>(() =>
      defaultValue ?? (selectionMode === 'multiple' ? [] : ''),
    );
    const resolvedValue = controlled ? value : internalValue;

    const isSelected = React.useCallback(
      (candidate: string) =>
        selectionMode === 'multiple'
          ? (Array.isArray(resolvedValue) ? resolvedValue : resolvedValue ? [resolvedValue] : []).includes(candidate)
          : (Array.isArray(resolvedValue) ? resolvedValue[0] : resolvedValue) === candidate,
      [resolvedValue, selectionMode],
    );

    const select = React.useCallback(
      (candidate: string) => {
        let nextValue: ChipGroupValue;

        if (selectionMode === 'multiple') {
          const current = Array.isArray(resolvedValue)
            ? resolvedValue
            : resolvedValue
              ? [resolvedValue]
              : [];
          nextValue = current.includes(candidate)
            ? current.filter((item) => item !== candidate)
            : [...current, candidate];
        } else {
          if (isSelected(candidate)) return;
          nextValue = candidate;
        }

        if (!controlled) setInternalValue(nextValue);
        onValueChange?.(nextValue);
      },
      [controlled, isSelected, onValueChange, resolvedValue, selectionMode],
    );

    const context = React.useMemo(
      () => ({ disabled, isSelected, selectionMode, select }),
      [disabled, isSelected, selectionMode, select],
    );

    return (
      <ChipGroupContext.Provider value={context}>
        <View
          ref={ref}
          {...props}
          accessibilityRole={selectionMode === 'single' ? 'radiogroup' : undefined}
          className={cn('flex-row flex-wrap gap-2', className)}
        >
          {children}
        </View>
      </ChipGroupContext.Provider>
    );
  },
);

ChipGroup.displayName = 'ChipGroup';

export type ChipProps = Omit<
  PressableProps,
  'accessibilityRole' | 'children' | 'role'
> & {
  children?: React.ReactNode;
  className?: string;
  defaultSelected?: boolean;
  labelClassName?: string;
  onSelectedChange?: (selected: boolean) => void;
  selected?: boolean;
  value?: string;
};

export const Chip = React.forwardRef<React.ComponentRef<typeof Pressable>, ChipProps>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      children,
      className,
      defaultSelected = false,
      disabled = false,
      labelClassName,
      onPress,
      onSelectedChange,
      selected,
      value,
      ...props
    },
    ref,
  ) => {
    const group = React.useContext(ChipGroupContext);
    const controlled = selected !== undefined;
    const [internalSelected, setInternalSelected] = React.useState(defaultSelected);
    const grouped = group !== null && value !== undefined;
    const resolvedSelected = grouped
      ? group.isSelected(value)
      : controlled
        ? selected
        : internalSelected;
    const isDisabled = disabled || group?.disabled === true;
    const childArray = React.Children.toArray(children);
    const inferredLabel = childArray.every(
      (child) => typeof child === 'string' || typeof child === 'number',
    )
      ? childArray.map(String).join('')
      : undefined;
    const role = grouped
      ? group.selectionMode === 'single'
        ? 'radio'
        : 'checkbox'
      : 'button';

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? inferredLabel}
        accessibilityRole={role}
        accessibilityState={{
          ...accessibilityState,
          disabled: isDisabled,
          ...(grouped ? { checked: resolvedSelected } : { selected: resolvedSelected }),
        }}
        className={cn(
          'min-h-9 flex-row items-center justify-center rounded-full border px-3 py-2 active:opacity-80',
          resolvedSelected
            ? 'border-primary bg-primary'
            : 'border-border-strong bg-surface web:hover:bg-surface-muted',
          isDisabled && 'opacity-50',
          className,
        )}
        disabled={isDisabled}
        onPress={(event) => {
          onPress?.(event);
          if (grouped && value !== undefined) {
            group.select(value);
            return;
          }

          const nextSelected = !resolvedSelected;
          if (!controlled) setInternalSelected(nextSelected);
          onSelectedChange?.(nextSelected);
        }}
      >
        {childArray.map((child, index) =>
          typeof child === 'string' || typeof child === 'number' ? (
            <Text
              key={`chip-label-${index}`}
              className={cn(
                resolvedSelected ? 'text-primary-foreground' : 'text-foreground',
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

Chip.displayName = 'Chip';
