import { cn } from '@beemvp/beeui-core';
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
  /** ORed into a `RadioGroup` rendered as `children`, disabling every `Radio` inside it. Defaults to false. */
  disabled?: boolean;
  /** Shown instead of `description`, styled destructively, when `invalid` is true. */
  error?: string;
  /** Switches the helper text below `children` from `description` to `error`. Defaults to false. */
  invalid?: boolean;
  /** Heading text for the group, rendered as a `Label` above `children` (e.g. "Shipping method"). */
  legend: string;
  /** `nativeID` for the rendered legend `Label`, used to build `accessibilityLabelledBy` links (e.g. from a `RadioGroup` rendered as `children`). Defaults to a generated, stable-per-mount ID. */
  legendNativeID?: string;
  /** Renders the legend with a required indicator and appends `requiredAccessibilityLabel` to its accessible name. Defaults to false. */
  required?: boolean;
  /** Text appended to the legend's accessible name when `required` is true (e.g. "Shipping method, required"). Defaults to `'required'`. */
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
