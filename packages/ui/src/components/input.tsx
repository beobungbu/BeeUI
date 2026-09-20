import { cn } from '@beemvp/beeui-core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { useFieldContext } from './field-context';
import { semanticTypographyClasses } from './text';

const inputVariants = cva(
  'w-full rounded-md border bg-input text-foreground focus:border-focus-ring web:focus-visible:bee-focus-ring',
  {
    variants: {
      size: {
        // Keep concrete leading utilities for React Native TextInput/textarea row measurement.
        // The font size still comes from the semantic typography token; leading-5/6 are
        // value-equivalent to the v2 label/body contracts and preserve pre-v2 numberOfLines sizing.
        // `min-h-*` (not the fixed `h-*` this used before #589) lets the row grow past its base
        // height instead of clipping: RN scales an explicit `lineHeight` by the OS font-scale the
        // same way it scales `fontSize` (`allowFontScaling` defaults to true), but a *fixed*
        // height never grew to match, so a taller scaled line got clipped. At the default 100%
        // font scale the natural content height (line-height + no vertical padding here) stays
        // below the floor, so `min-h-*` clamps to the exact same rendered height as before.
        sm: `min-h-control-compact px-3 ${semanticTypographyClasses.label} leading-5 ios:min-h-touch-target android:min-h-touch-target`,
        md: `min-h-control-default px-3 ${semanticTypographyClasses.body} leading-6`,
        lg: `min-h-control-large px-4 ${semanticTypographyClasses.body} leading-6`,
      },
      invalid: {
        true: 'border-destructive focus:border-destructive',
        false: 'border-control-border',
      },
    },
    defaultVariants: {
      size: 'md',
      invalid: false,
    },
  },
);

type EngineTextInputProps = TextInputProps & {
  'aria-required'?: boolean;
  cursorColorClassName?: string;
  placeholderTextColorClassName?: string;
  selectionColorClassName?: string;
  selectionHandleColorClassName?: string;
  underlineColorAndroidClassName?: string;
};

const EngineTextInput = React.forwardRef<React.ComponentRef<typeof TextInput>, EngineTextInputProps>(
  (props, ref) => <TextInput ref={ref} {...props} />,
);

EngineTextInput.displayName = 'BeeUIEngineTextInput';

export type InputProps = TextInputProps &
  Omit<VariantProps<typeof inputVariants>, 'invalid'> & {
    className?: string;
    /** Sets `editable={false}` (unless `editable` is already explicitly `false`) and applies disabled styling. ORed with the enclosing `Field`'s own `disabled`. Defaults to false. */
    disabled?: boolean;
    /** Applies destructive border styling and, when true, uses the enclosing `Field`'s `error` (instead of its `description`) as this input's accessibility hint. ORed with the enclosing `Field`'s own `invalid`. Defaults to false. */
    invalid?: boolean;
  };

export const Input = React.forwardRef<React.ComponentRef<typeof TextInput>, InputProps>(
  (
    {
      accessibilityHint,
      accessibilityLabel,
      accessibilityLabelledBy,
      accessibilityState,
      accessibilityValue,
      className,
      defaultValue,
      disabled,
      editable,
      invalid,
      onChangeText,
      size,
      value,
      ...props
    },
    ref,
  ) => {
    const field = useFieldContext();
    const resolvedDisabled = disabled === true || field?.disabled === true;
    const resolvedInvalid = invalid === true || field?.invalid === true;
    const resolvedHint =
      accessibilityHint ?? (resolvedInvalid ? field?.error : field?.description);
    // No hardcoded English "required" copy — only a caller-supplied, localized
    // `Field.requiredLabel` (or the deprecated `Field.requiredAccessibilityLabel`,
    // when a caller sets it explicitly) is ever appended to the fallback name;
    // otherwise `required` reaches assistive tech solely through `aria-required`
    // below.
    const requiredSuffix = field?.required
      ? (field.requiredLabel ?? field.requiredAccessibilityLabel)
      : undefined;
    const resolvedAccessibilityLabel =
      accessibilityLabel ?? (requiredSuffix ? `${field?.label}, ${requiredSuffix}` : field?.label);

    // #614 — once an `accessibilityLabel` is present, iOS VoiceOver stops
    // announcing a plain TextInput's own typed value (the label replaces
    // rather than joins the native value announcement), leaving a labelled
    // field silently unreadable. Track the current text ourselves (mirroring
    // `value` when controlled, `onChangeText` when not) and publish it through
    // `accessibilityValue.text` so both the label and the value stay exposed.
    // Scoped to the exact labelled case the issue reports: an unlabelled
    // input already exposes its value correctly and is left untouched. A
    // caller's own `accessibilityValue.text` always wins.
    // Never auto-publish the raw text while `secureTextEntry` is set — that
    // would hand a masked password's plaintext straight to assistive tech, the
    // exact thing masking exists to prevent. A caller-supplied
    // `accessibilityValue.text` still wins in every case, masked or not.
    const isControlledValue = typeof value === 'string';
    const [trackedValue, setTrackedValue] = React.useState(
      isControlledValue ? value : typeof defaultValue === 'string' ? defaultValue : '',
    );
    const resolvedValue = isControlledValue ? value : trackedValue;
    const autoAccessibilityText = props.secureTextEntry ? undefined : resolvedValue;
    const resolvedAccessibilityValue = resolvedAccessibilityLabel
      ? accessibilityValue?.text !== undefined
        ? accessibilityValue
        : autoAccessibilityText !== undefined
          ? { ...accessibilityValue, text: autoAccessibilityText }
          : accessibilityValue
      : accessibilityValue;

    return (
      <EngineTextInput
        ref={ref}
        {...props}
        accessibilityHint={resolvedHint}
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityLabelledBy={accessibilityLabelledBy ?? field?.labelNativeID}
        accessibilityState={{ ...accessibilityState, disabled: resolvedDisabled }}
        accessibilityValue={resolvedAccessibilityValue}
        // `required` reaches the DOM via `aria-required` (RN's compound
        // `accessibilityState` has no `required` key) rather than injected text.
        aria-required={field?.required || undefined}
        className={cn(
          inputVariants({ invalid: resolvedInvalid, size }),
          resolvedDisabled &&
            'border-control-border bg-disabled text-disabled-foreground opacity-70',
          className,
        )}
        cursorColorClassName="accent-primary"
        defaultValue={defaultValue}
        editable={!resolvedDisabled && editable !== false}
        onChangeText={(text) => {
          if (!isControlledValue) setTrackedValue(text);
          onChangeText?.(text);
        }}
        placeholderTextColorClassName="accent-muted-foreground"
        selectionColorClassName="accent-primary"
        selectionHandleColorClassName="accent-primary"
        underlineColorAndroidClassName="accent-transparent"
        value={value}
      />
    );
  },
);

Input.displayName = 'Input';

export { inputVariants };
