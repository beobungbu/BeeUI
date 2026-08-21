import { cn } from '@beeui/core';
import * as React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { Box } from './box';
import { Text } from './text';

function isPrimitiveAccessibilityContent(value: React.ReactNode) {
  return value == null || typeof value === 'string' || typeof value === 'number';
}

function getPrimitiveAccessibilityLabel(...values: React.ReactNode[]) {
  if (!values.every(isPrimitiveAccessibilityContent)) return undefined;

  const parts = values
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .map(String)
    .filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : undefined;
}

function renderSettingsValue(value: React.ReactNode) {
  return typeof value === 'string' || typeof value === 'number' ? (
    <Text tone="muted" variant="label">
      {value}
    </Text>
  ) : (
    value
  );
}

export type ListItemProps = Omit<
  PressableProps,
  'accessibilityRole' | 'accessibilityState' | 'children' | 'role'
> & {
  className?: string;
  description?: React.ReactNode;
  descriptionClassName?: string;
  leading?: React.ReactNode;
  title: React.ReactNode;
  titleClassName?: string;
  trailing?: React.ReactNode;
};

export const ListItem = React.forwardRef<React.ComponentRef<typeof Pressable>, ListItemProps>(
  (
    {
      accessibilityLabel,
      className,
      description,
      descriptionClassName,
      disabled = false,
      leading,
      onPress,
      title,
      titleClassName,
      trailing,
      ...props
    },
    ref,
  ) => {
    const interactive = typeof onPress === 'function';
    const isDisabled = disabled === true;
    const inferredLabel = getPrimitiveAccessibilityLabel(title, description, trailing);
    const groupPrimitiveContent = !interactive && inferredLabel !== undefined;

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? inferredLabel}
        accessibilityRole={interactive ? 'button' : undefined}
        accessibilityState={interactive ? { disabled: isDisabled } : undefined}
        accessible={interactive || groupPrimitiveContent ? true : undefined}
        className={cn(
          'min-h-14 w-full flex-row items-center gap-3 rounded-md px-3 py-2',
          interactive && 'active:bg-surface-muted web:hover:bg-surface-muted',
          isDisabled && 'opacity-60',
          className,
        )}
        disabled={isDisabled || !interactive}
        onPress={onPress}
      >
        {leading ? <Box className="shrink-0">{leading}</Box> : null}
        <Box className="min-w-0 flex-1 gap-0.5">
          {typeof title === 'string' || typeof title === 'number' ? (
            <Text className={titleClassName} variant="label">
              {title}
            </Text>
          ) : (
            title
          )}
          {description ? (
            typeof description === 'string' || typeof description === 'number' ? (
              <Text className={descriptionClassName} tone="muted" variant="caption">
                {description}
              </Text>
            ) : (
              description
            )
          ) : null}
        </Box>
        {trailing ? <Box className="shrink-0">{trailing}</Box> : null}
      </Pressable>
    );
  },
);

ListItem.displayName = 'ListItem';

export type SettingsItemProps = Omit<ListItemProps, 'trailing'> & {
  trailing?: React.ReactNode;
  value?: React.ReactNode;
};

export const SettingsItem = React.forwardRef<React.ComponentRef<typeof Pressable>, SettingsItemProps>(
  ({ accessibilityLabel, description, title, trailing, value, ...props }, ref) => {
    const renderedValue = value == null ? null : renderSettingsValue(value);
    const resolvedTrailing =
      renderedValue && trailing ? (
        <Box className="flex-row items-center gap-2">
          {renderedValue}
          {trailing}
        </Box>
      ) : (
        trailing ?? renderedValue
      );
    const inferredLabel = getPrimitiveAccessibilityLabel(
      title,
      description,
      value ?? (isPrimitiveAccessibilityContent(trailing) ? trailing : undefined),
    );

    return (
      <ListItem
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? inferredLabel}
        description={description}
        title={title}
        trailing={resolvedTrailing}
      />
    );
  },
);

SettingsItem.displayName = 'SettingsItem';
