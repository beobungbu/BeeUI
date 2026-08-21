import { cn } from '@beeui/core';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { Text } from './text';

type AccordionContextValue = {
  collapsible: boolean;
  disabled: boolean;
  setValue: (value: string | null) => void;
  value: string | null;
};

type AccordionItemContextValue = { value: string };

const AccordionContext = React.createContext<AccordionContextValue | null>(null);
const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null);

function useAccordionContext() {
  const context = React.useContext(AccordionContext);
  if (!context) throw new Error('Accordion components must be used inside Accordion.');
  return context;
}

function useAccordionItemContext() {
  const context = React.useContext(AccordionItemContext);
  if (!context) throw new Error('AccordionTrigger/Content must be used inside AccordionItem.');
  return context;
}

export type AccordionProps = Omit<ViewProps, 'children'> & {
  children?: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultValue?: string | null;
  disabled?: boolean;
  onValueChange?: (value: string | null) => void;
  value?: string | null;
};

export const Accordion = React.forwardRef<React.ComponentRef<typeof View>, AccordionProps>(
  ({ children, className, collapsible = true, defaultValue = null, disabled = false, onValueChange, value, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState<string | null>(defaultValue);
    const controlled = value !== undefined;
    const resolvedValue = controlled ? value : internalValue;

    const setValue = React.useCallback(
      (nextValue: string | null) => {
        if (disabled) return;
        if (!controlled) setInternalValue(nextValue);
        onValueChange?.(nextValue);
      },
      [controlled, disabled, onValueChange],
    );

    const context = React.useMemo(
      () => ({ collapsible, disabled, setValue, value: resolvedValue }),
      [collapsible, disabled, resolvedValue, setValue],
    );

    return (
      <AccordionContext.Provider value={context}>
        <View ref={ref} className={cn('w-full', className)} {...props}>
          {children}
        </View>
      </AccordionContext.Provider>
    );
  },
);

Accordion.displayName = 'Accordion';

export type AccordionItemProps = Omit<ViewProps, 'children'> & {
  children?: React.ReactNode;
  className?: string;
  value: string;
};

export const AccordionItem = React.forwardRef<React.ComponentRef<typeof View>, AccordionItemProps>(
  ({ children, className, value, ...props }, ref) => (
    <AccordionItemContext.Provider value={{ value }}>
      <View ref={ref} className={cn('border-b border-border', className)} {...props}>
        {children}
      </View>
    </AccordionItemContext.Provider>
  ),
);

AccordionItem.displayName = 'AccordionItem';

export type AccordionTriggerProps = Omit<
  PressableProps,
  'accessibilityRole' | 'accessibilityState' | 'children' | 'disabled' | 'role'
> & {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  labelClassName?: string;
};

export const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  AccordionTriggerProps
>(({ accessibilityLabel, children, className, disabled = false, labelClassName, onPress, ...props }, ref) => {
  const accordion = useAccordionContext();
  const item = useAccordionItemContext();
  const open = accordion.value === item.value;
  const isDisabled = accordion.disabled || disabled;
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
      accessibilityState={{ disabled: isDisabled, expanded: open }}
      className={cn(
        'min-h-12 flex-row items-center justify-between py-3 active:opacity-80',
        className,
      )}
      disabled={isDisabled}
      onPress={(event) => {
        onPress?.(event);
        accordion.setValue(open && accordion.collapsible ? null : item.value);
      }}
    >
      {childArray.map((child, index) =>
        typeof child === 'string' || typeof child === 'number' ? (
          <Text key={`accordion-trigger-${index}`} className={labelClassName} variant="label">
            {child}
          </Text>
        ) : (
          child
        ),
      )}
    </Pressable>
  );
});

AccordionTrigger.displayName = 'AccordionTrigger';

export type AccordionContentProps = Omit<ViewProps, 'role'> & {
  className?: string;
};

export const AccordionContent = React.forwardRef<
  React.ComponentRef<typeof View>,
  AccordionContentProps
>(({ className, ...props }, ref) => {
  const accordion = useAccordionContext();
  const item = useAccordionItemContext();
  if (accordion.value !== item.value) return null;

  return <View ref={ref} className={cn('pb-4', className)} role="region" {...props} />;
});

AccordionContent.displayName = 'AccordionContent';
