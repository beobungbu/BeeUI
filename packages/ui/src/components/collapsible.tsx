import { cn } from '@beeui/core';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { Text } from './text';

type CollapsibleContextValue = {
  disabled: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null);

function useCollapsibleContext() {
  const context = React.useContext(CollapsibleContext);
  if (!context) throw new Error('Collapsible components must be used inside Collapsible.');
  return context;
}

export type CollapsibleProps = Omit<ViewProps, 'children'> & {
  children?: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
};

export const Collapsible = React.forwardRef<React.ComponentRef<typeof View>, CollapsibleProps>(
  ({ children, className, defaultOpen = false, disabled = false, onOpenChange, open, ...props }, ref) => {
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
    const controlled = open !== undefined;
    const resolvedOpen = controlled ? open : internalOpen;

    const setOpen = React.useCallback(
      (nextOpen: boolean) => {
        if (disabled) return;
        if (!controlled) setInternalOpen(nextOpen);
        onOpenChange?.(nextOpen);
      },
      [controlled, disabled, onOpenChange],
    );

    const context = React.useMemo(
      () => ({ disabled, open: resolvedOpen, setOpen }),
      [disabled, resolvedOpen, setOpen],
    );

    return (
      <CollapsibleContext.Provider value={context}>
        <View ref={ref} className={className} {...props}>
          {children}
        </View>
      </CollapsibleContext.Provider>
    );
  },
);

Collapsible.displayName = 'Collapsible';

export type CollapsibleTriggerProps = Omit<
  PressableProps,
  'accessibilityRole' | 'accessibilityState' | 'children' | 'disabled' | 'role'
> & {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  labelClassName?: string;
};

export const CollapsibleTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  CollapsibleTriggerProps
>(({ accessibilityLabel, children, className, disabled = false, labelClassName, onPress, ...props }, ref) => {
  const context = useCollapsibleContext();
  const isDisabled = context.disabled || disabled;
  const childArray = React.Children.toArray(children);
  const inferredLabel = childArray.every((child) => typeof child === 'string' || typeof child === 'number')
    ? childArray.map(String).join('')
    : undefined;

  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityLabel={accessibilityLabel ?? inferredLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, expanded: context.open }}
      className={cn(
        'min-h-11 flex-row items-center justify-between rounded-md px-3 py-2 active:bg-muted web:hover:bg-surface-muted',
        className,
      )}
      disabled={isDisabled}
      onPress={(event) => {
        onPress?.(event);
        context.setOpen(!context.open);
      }}
    >
      {childArray.map((child, index) =>
        typeof child === 'string' || typeof child === 'number' ? (
          <Text key={`collapsible-trigger-${index}`} className={labelClassName} variant="label">
            {child}
          </Text>
        ) : (
          child
        ),
      )}
    </Pressable>
  );
});

CollapsibleTrigger.displayName = 'CollapsibleTrigger';

export type CollapsibleContentProps = Omit<ViewProps, 'role'> & {
  className?: string;
};

export const CollapsibleContent = React.forwardRef<
  React.ComponentRef<typeof View>,
  CollapsibleContentProps
>(({ className, ...props }, ref) => {
  const { open } = useCollapsibleContext();
  if (!open) return null;

  return <View ref={ref} className={cn('pt-2', className)} role="region" {...props} />;
});

CollapsibleContent.displayName = 'CollapsibleContent';
