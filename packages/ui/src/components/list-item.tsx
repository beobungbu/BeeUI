import { cn } from '@beeui/core';
import * as React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { Box } from './box';
import { Text } from './text';

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
    const inferredLabel = typeof title === 'string' || typeof title === 'number' ? String(title) : undefined;

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? (interactive ? inferredLabel : undefined)}
        accessibilityRole={interactive ? 'button' : undefined}
        accessibilityState={interactive ? { disabled } : undefined}
        accessible={interactive}
        className={cn(
          'min-h-14 w-full flex-row items-center gap-3 rounded-md px-3 py-2',
          interactive && 'active:bg-muted web:hover:bg-surface-muted',
          disabled && 'opacity-60',
          className,
        )}
        disabled={disabled || !interactive}
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
  ({ trailing, value, ...props }, ref) => (
    <ListItem
      ref={ref}
      {...props}
      trailing={
        trailing ??
        (typeof value === 'string' || typeof value === 'number' ? (
          <Text tone="muted" variant="label">
            {value}
          </Text>
        ) : (
          value
        ))
      }
    />
  ),
);

SettingsItem.displayName = 'SettingsItem';
