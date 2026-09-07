import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { FieldContext, type FieldContextValue } from './field-context';
import { Label } from './label';
import { Text } from './text';

export type FieldProps = Omit<ViewProps, 'children'> & {
  children: React.ReactNode;
  className?: string;
  description?: string;
  /** ORed into the field's own `disabled` by any BeeUI form control (Input, Select, DatePicker, etc.) rendered as `children`. Defaults to false. */
  disabled?: boolean;
  /** Shown instead of `description`, styled destructively, when `invalid` is true. */
  error?: string;
  /** ORed into the field's own `invalid` by any BeeUI form control rendered as `children`, and switches the helper text below it from `description` to `error`. Defaults to false. */
  invalid?: boolean;
  label: string;
  /** `nativeID` for the rendered `Label`, used to build `accessibilityLabelledBy` links. Defaults to a generated, stable-per-mount ID. */
  labelNativeID?: string;
  /** Renders the label with a required indicator and exposes it via `requiredAccessibilityLabel`. Defaults to false. */
  required?: boolean;
  /** Accessible label appended to the field's name when `required` is true (e.g. announced as "Email, required"). Defaults to `'required'`. */
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
        <View
          ref={ref}
          // Gap between label/children/helper text comes from the #74 application-density
          // axis (`--spacing-density-form-gap`, default = comfortable = the pre-#74 `gap-2`
          // literal, pixel-identical).
          className={cn('gap-density-form-gap', className)}
          {...props}
        >
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
