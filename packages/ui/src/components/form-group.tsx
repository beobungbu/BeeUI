import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { Platform, View, type ViewProps } from 'react-native';
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
  /** Renders the legend with a required indicator and, when `requiredAccessibilityLabel` is also supplied, appends it to the accessible name. Defaults to false. */
  required?: boolean;
  /** Text appended to the legend's accessible name when `required` is true (e.g. "Shipping method, required"). No default — omit to expose `required` only through the group's own required semantics on its interactive descendants, without injecting English copy. */
  requiredAccessibilityLabel?: string;
};

export const FormGroup = React.forwardRef<React.ComponentRef<typeof View>, FormGroupProps>(
  (
    {
      accessibilityLabel,
      accessibilityLabelledBy,
      accessibilityState,
      children,
      className,
      description,
      disabled = false,
      error,
      invalid = false,
      legend,
      legendNativeID,
      required = false,
      requiredAccessibilityLabel,
      ...props
    },
    ref,
  ) => {
    const reactId = React.useId();
    const generatedLegendNativeID = `beeui-form-group-${reactId.replace(/:/g, '')}-legend`;
    const resolvedLegendNativeID = legendNativeID ?? generatedLegendNativeID;
    // No hardcoded English "required" copy — only a caller-supplied,
    // localized `requiredAccessibilityLabel` is ever appended to the group's
    // name; otherwise `required` reaches assistive tech through each
    // interactive descendant's own required semantics (matching `Field`).
    const legendAccessibilityLabel =
      required && requiredAccessibilityLabel ? `${legend}, ${requiredAccessibilityLabel}` : legend;
    // Helper text (the error when invalid, else the description) gets its own
    // nativeID so the group container itself can be described by it, the same
    // relationship a native `<fieldset>`/`<legend>` + description pattern
    // gives for free.
    const showError = invalid && Boolean(error);
    const helperText = showError ? error : description;
    const helperNativeID = helperText ? `${resolvedLegendNativeID}-helper` : undefined;
    const resolvedAccessibilityLabelledBy =
      accessibilityLabelledBy ?? (accessibilityLabel === undefined ? resolvedLegendNativeID : undefined);
    // The real DOM `aria-labelledby`/`aria-describedby` attributes are single
    // space-separated ID-list strings, while the RN-side
    // `accessibilityLabelledBy` prop also accepts an array of IDs.
    const resolvedAriaLabelledBy = Array.isArray(resolvedAccessibilityLabelledBy)
      ? resolvedAccessibilityLabelledBy.join(' ')
      : resolvedAccessibilityLabelledBy;

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
          accessibilityLabel={accessibilityLabel}
          accessibilityLabelledBy={resolvedAccessibilityLabelledBy}
          accessibilityState={{ ...accessibilityState, disabled }}
          // Gap between legend/children/helper text comes from the #74 application-density
          // axis (`--spacing-density-form-gap`, default = comfortable = the pre-#74 `gap-2`
          // literal, pixel-identical).
          className={cn('gap-density-form-gap', className)}
          role="group"
          {...(Platform.OS === 'web'
            ? {
                // See Checkbox/Switch: `accessibilityState`/`accessibilityLabelledBy`
                // do not reliably reach the DOM through react-native-web for a
                // compound relationship like this one, and RN has no
                // cross-platform equivalent of `aria-describedby` at all —
                // setting these web-native `aria-*` props directly keeps native
                // platforms (which read the RN-side props above) and Web (which
                // reads `aria-*`) both correct (#571).
                'aria-describedby': helperNativeID,
                'aria-invalid': invalid || undefined,
                'aria-labelledby': resolvedAriaLabelledBy,
              }
            : null)}
        >
          {/* This Label never carries its own
              accessible name — a child that consumes FormGroupContext (RadioGroup,
              Checkbox) already derives its own `legendAccessibilityLabel`/`aria-labelledby`
              from context, so the name lives once, not duplicated onto this Label too. */}
          <Label
            nativeID={resolvedLegendNativeID}
            presentational
            required={required}
            requiredAccessibilityLabel={requiredAccessibilityLabel}
          >
            {legend}
          </Label>
          {children}
          {showError ? (
            <Text
              accessibilityLiveRegion="polite"
              nativeID={helperNativeID}
              role="alert"
              tone="destructive"
              variant="caption"
            >
              {error}
            </Text>
          ) : description ? (
            <Text nativeID={helperNativeID} tone="muted" variant="caption">
              {description}
            </Text>
          ) : null}
        </View>
      </FormGroupContext.Provider>
    );
  },
);

FormGroup.displayName = 'FormGroup';
