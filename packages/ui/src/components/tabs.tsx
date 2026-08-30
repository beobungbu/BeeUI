import { cn } from '@beeui/core';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { Text } from './text';
import { useRequiredCallbackWarning } from './use-required-callback-warning';

type TabsContextValue = {
  disabled: boolean;
  onValueChange?: (value: string) => void;
  value: string;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(component: string) {
  const context = React.useContext(TabsContext);

  if (!context) {
    throw new Error(`${component} must be rendered inside <Tabs>.`);
  }

  return context;
}

export type TabsProps = Omit<ViewProps, 'children'> & {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  value: string;
};

export const Tabs = React.forwardRef<React.ComponentRef<typeof View>, TabsProps>(
  ({ children, className, disabled = false, onValueChange, value, ...props }, ref) => {
    useRequiredCallbackWarning('Tabs', 'onValueChange', onValueChange, disabled);

    const contextValue = React.useMemo(
      () => ({ disabled, onValueChange, value }),
      [disabled, onValueChange, value],
    );

    return (
      <TabsContext.Provider value={contextValue}>
        <View ref={ref} className={cn('gap-4', className)} {...props}>
          {children}
        </View>
      </TabsContext.Provider>
    );
  },
);

Tabs.displayName = 'Tabs';

export type TabsListProps = Omit<ViewProps, 'accessibilityRole' | 'role'> & {
  className?: string;
};

export const TabsList = React.forwardRef<React.ComponentRef<typeof View>, TabsListProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      {...props}
      accessibilityRole="tablist"
      className={cn('flex-row gap-1 rounded-md bg-muted p-1', className)}
    />
  ),
);

TabsList.displayName = 'TabsList';

export type TabsTriggerProps = Omit<
  PressableProps,
  'accessibilityRole' | 'role' | 'children' | 'onPress'
> & {
  children?: React.ReactNode;
  className?: string;
  labelClassName?: string;
  value: string;
};

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  TabsTriggerProps
>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      children,
      className,
      disabled = false,
      labelClassName,
      value,
      ...props
    },
    ref,
  ) => {
    const tabs = useTabsContext('TabsTrigger');
    const selected = tabs.value === value;
    const isDisabled = disabled === true || tabs.disabled;
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
        accessibilityRole="tab"
        accessibilityState={{
          ...accessibilityState,
          disabled: isDisabled,
          selected,
        }}
        className={cn(
          'min-h-9 flex-1 items-center justify-center rounded-sm border px-3 py-2 active:opacity-80 web:focus-visible:bee-focus-ring',
          selected
            ? 'border-border bg-surface-raised'
            : 'border-transparent bg-transparent',
          isDisabled && 'opacity-50',
          className,
        )}
        disabled={isDisabled}
        onPress={() => {
          if (!selected) {
            tabs.onValueChange?.(value);
          }
        }}
      >
        {childArray.map((child, index) =>
          typeof child === 'string' || typeof child === 'number' ? (
            <Text
              key={`tab-label-${index}`}
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

TabsTrigger.displayName = 'TabsTrigger';

export type TabsContentProps = Omit<ViewProps, 'children' | 'role'> & {
  children?: React.ReactNode;
  className?: string;
  value: string;
};

export const TabsContent = React.forwardRef<React.ComponentRef<typeof View>, TabsContentProps>(
  ({ children, className, value, ...props }, ref) => {
    const tabs = useTabsContext('TabsContent');

    if (tabs.value !== value) {
      return null;
    }

    return (
      <View ref={ref} {...props} className={className} role="tabpanel">
        {children}
      </View>
    );
  },
);

TabsContent.displayName = 'TabsContent';
