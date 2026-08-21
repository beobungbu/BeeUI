import { cn } from '@beeui/core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { FieldContext, type FieldContextValue } from './field-context';
import { Text } from './text';

export type FieldProps = Omit<ViewProps, 'children'> & {
  children: React.ReactNode;
  className?: string;
  description?: string;
  disabled?: boolean;
  error?: string;
  invalid?: boolean;
  label: string;
  required?: boolean;
};

export const Field = React.forwardRef<React.ComponentRef<typeof View>, FieldProps>(
  (
    {
      children,
      className,
      description,
      disabled = false,
      error,
      invalid = false,
      label,
      required = false,
      ...props
    },
    ref,
  ) => {
    const contextValue = React.useMemo<FieldContextValue>(
      () => ({ description, disabled, error, invalid, label }),
      [description, disabled, error, invalid, label],
    );

    return (
      <FieldContext.Provider value={contextValue}>
        <View ref={ref} className={cn('gap-2', className)} {...props}>
          <Text variant="label">
            {label}
            {required ? (
              <Text tone="destructive" variant="label">
                {' *'}
              </Text>
            ) : null}
          </Text>
          {children}
          {invalid && error ? (
            <Text accessibilityLiveRegion="polite" role="alert" tone="destructive" variant="caption">
              {error}
            </Text>
          ) : description ? (
            <Text tone="muted" variant="caption">
              {description}
            </Text>
          ) : null}
        </View>
      </FieldContext.Provider>
    );
  },
);

Field.displayName = 'Field';
