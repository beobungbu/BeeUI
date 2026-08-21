import { cn } from '@beeui/core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { FieldContext, type FieldContextValue } from './field-context';
import { Label } from './label';
import { Text } from './text';

export type FieldProps = Omit<ViewProps, 'children'> & {
  children: React.ReactNode;
  className?: string;
  description?: string;
  disabled?: boolean;
  error?: string;
  invalid?: boolean;
  label: string;
  labelNativeID?: string;
  required?: boolean;
  requiredAccessibilityLabel?: string;
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
      labelNativeID,
      required = false,
      requiredAccessibilityLabel = 'required',
      ...props
    },
    ref,
  ) => {
    const reactId = React.useId();
    const generatedLabelNativeID = `beeui-field-${reactId.replace(/:/g, '')}-label`;
    const resolvedLabelNativeID = labelNativeID ?? generatedLabelNativeID;
    const contextValue = React.useMemo<FieldContextValue>(
      () => ({
        description,
        disabled,
        error,
        invalid,
        label,
        labelNativeID: resolvedLabelNativeID,
        required,
        requiredAccessibilityLabel,
      }),
      [
        description,
        disabled,
        error,
        invalid,
        label,
        required,
        requiredAccessibilityLabel,
        resolvedLabelNativeID,
      ],
    );

    return (
      <FieldContext.Provider value={contextValue}>
        <View ref={ref} className={cn('gap-2', className)} {...props}>
          <Label
            nativeID={resolvedLabelNativeID}
            required={required}
            requiredAccessibilityLabel={requiredAccessibilityLabel}
          >
            {label}
          </Label>
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
