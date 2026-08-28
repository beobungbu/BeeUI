import { cn } from '@beeui/core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { FormGroupContext, type FormGroupContextValue } from './form-group-context';
import { Label } from './label';
import { Text } from './text';

export type FormGroupProps = Omit<
  ViewProps,
  'accessibilityRole' | 'accessible' | 'children' | 'role'
> & {
  children: React.ReactNode;
  className?: string;
  description?: string;
  disabled?: boolean;
  error?: string;
  invalid?: boolean;
  legend: string;
  legendNativeID?: string;
  required?: boolean;
  requiredAccessibilityLabel?: string;
};

export const FormGroup = React.forwardRef<React.ComponentRef<typeof View>, FormGroupProps>(
  (
    {
      children,
      className,
      description,
      disabled = false,
      error,
      invalid = false,
      legend,
      legendNativeID,
      required = false,
      requiredAccessibilityLabel = 'required',
      ...props
    },
    ref,
  ) => {
    const reactId = React.useId();
    const generatedLegendNativeID = `beeui-form-group-${reactId.replace(/:/g, '')}-legend`;
    const resolvedLegendNativeID = legendNativeID ?? generatedLegendNativeID;
    const legendAccessibilityLabel = required
      ? `${legend}, ${requiredAccessibilityLabel}`
      : legend;
    const contextValue = React.useMemo<FormGroupContextValue>(
      () => ({
        description,
        disabled,
        error,
        invalid,
        legendAccessibilityLabel,
        legendNativeID: resolvedLegendNativeID,
        required,
      }),
      [
        description,
        disabled,
        error,
        invalid,
        legendAccessibilityLabel,
        required,
        resolvedLegendNativeID,
      ],
    );

    return (
      <FormGroupContext.Provider value={contextValue}>
        <View
          ref={ref}
          {...props}
          accessible={false}
          // Gap between legend/children/helper text comes from the #74 application-density
          // axis (`--spacing-density-form-gap`, default = comfortable = the pre-#74 `gap-2`
          // literal, pixel-identical).
          className={cn('gap-density-form-gap', className)}
        >
          <Label
            nativeID={resolvedLegendNativeID}
            required={required}
            requiredAccessibilityLabel={requiredAccessibilityLabel}
          >
            {legend}
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
      </FormGroupContext.Provider>
    );
  },
);

FormGroup.displayName = 'FormGroup';
