import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { Text } from './text';
import { useDirection } from './use-direction';

function getBreadcrumbChildKey(item: React.ReactNode, index: number) {
  return React.isValidElement(item) && item.key != null ? item.key : `breadcrumb-item-${index}`;
}

export type BreadcrumbProps = Omit<ViewProps, 'children'> & {
  children?: React.ReactNode;
  className?: string;
  separator?: React.ReactNode;
};

export const Breadcrumb = React.forwardRef<React.ComponentRef<typeof View>, BreadcrumbProps>(
  ({ children, className, separator, ...props }, ref) => {
    const items = React.Children.toArray(children);
    // The default separator points along the reading direction: toward the end
    // (visual right) in LTR, toward the start (visual left) in RTL. A consumer's
    // explicit `separator` (including `null`) is always respected unchanged.
    const direction = useDirection();
    const resolvedSeparator = separator === undefined ? (direction === 'rtl' ? '‹' : '›') : separator;

    return (
      <View
        ref={ref}
        accessible={false}
        className={cn('flex-row flex-wrap items-center gap-2', className)}
        {...props}
      >
        {items.map((item, index) => (
          <React.Fragment key={getBreadcrumbChildKey(item, index)}>
            {item}
            {index < items.length - 1 ? (
              <View
                accessibilityElementsHidden
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                {typeof resolvedSeparator === 'string' ||
                typeof resolvedSeparator === 'number' ? (
                  <Text tone="muted" variant="caption">
                    {resolvedSeparator}
                  </Text>
                ) : (
                  resolvedSeparator
                )}
              </View>
            ) : null}
          </React.Fragment>
        ))}
      </View>
    );
  },
);

Breadcrumb.displayName = 'Breadcrumb';

export type BreadcrumbItemProps = Omit<
  PressableProps,
  'accessibilityRole' | 'children' | 'role'
> & {
  children?: React.ReactNode;
  className?: string;
  current?: boolean;
  labelClassName?: string;
};

export const BreadcrumbItem = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  BreadcrumbItemProps
>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      children,
      className,
      current = false,
      disabled = false,
      labelClassName,
      onPress,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled === true;
    const interactive = typeof onPress === 'function' && !current;
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
        accessibilityRole={interactive ? 'link' : 'text'}
        accessibilityState={{ ...accessibilityState, disabled: isDisabled, selected: current }}
        className={cn(
          'self-start rounded-sm',
          interactive && 'active:opacity-70',
          isDisabled && 'opacity-50',
          className,
        )}
        disabled={isDisabled || !interactive}
        onPress={interactive ? onPress : undefined}
      >
        {childArray.map((child, index) =>
          typeof child === 'string' || typeof child === 'number' ? (
            <Text
              key={`breadcrumb-label-${index}`}
              className={cn(current && 'font-semibold', interactive && 'underline', labelClassName)}
              tone={interactive ? 'primary' : current ? 'default' : 'muted'}
              variant="caption"
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

BreadcrumbItem.displayName = 'BreadcrumbItem';
