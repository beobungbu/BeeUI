import { cn } from '@beeui/core';
import * as React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { Text } from './text';

export type LinkProps = Omit<PressableProps, 'accessibilityRole' | 'children' | 'role'> & {
  children?: React.ReactNode;
  className?: string;
  labelClassName?: string;
};

export const Link = React.forwardRef<React.ComponentRef<typeof Pressable>, LinkProps>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      children,
      className,
      disabled = false,
      labelClassName,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled === true;
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
        accessibilityRole="link"
        accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
        className={cn('self-start active:opacity-70', isDisabled && 'opacity-50', className)}
        disabled={isDisabled}
      >
        {childArray.map((child, index) =>
          typeof child === 'string' || typeof child === 'number' ? (
            <Text
              key={`link-label-${index}`}
              className={cn('text-primary underline', labelClassName)}
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

Link.displayName = 'Link';
