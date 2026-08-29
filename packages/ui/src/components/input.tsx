import { cn } from '@beeui/core';
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
        sm: `h-control-compact px-3 ${semanticTypographyClasses.label} leading-5 ios:min-h-touch-target android:min-h-touch-target`,
        md: `h-control-default px-3 ${semanticTypographyClasses.body} leading-6`,
        lg: `h-control-large px-4 ${semanticTypographyClasses.body} leading-6`,
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
    disabled?: boolean;
    invalid?: boolean;
  };

export const Input = React.forwardRef<React.ComponentRef<typeof TextInput>, InputProps>(
  (
    {
      accessibilityHint,
      accessibilityLabel,
      accessibilityLabelledBy,
      accessibilityState,
      className,
      disabled,
      editable,
      invalid,
      size,
      ...props
    },
    ref,
  ) => {
    const field = useFieldContext();
    const resolvedDisabled = disabled === true || field?.disabled === true;
    const resolvedInvalid = invalid === true || field?.invalid === true;
    const resolvedHint =
      accessibilityHint ?? (resolvedInvalid ? field?.error : field?.description);
    const resolvedAccessibilityLabel =
      accessibilityLabel ??
      (field?.required
        ? `${field.label}, ${field.requiredAccessibilityLabel}`
        : field?.label);

    return (
      <EngineTextInput
        ref={ref}
        {...props}
        accessibilityHint={resolvedHint}
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityLabelledBy={accessibilityLabelledBy ?? field?.labelNativeID}
        accessibilityState={{ ...accessibilityState, disabled: resolvedDisabled }}
        className={cn(
          inputVariants({ invalid: resolvedInvalid, size }),
          resolvedDisabled &&
            'border-control-border bg-disabled text-disabled-foreground opacity-70',
          className,
        )}
        cursorColorClassName="accent-primary"
        editable={!resolvedDisabled && editable !== false}
        placeholderTextColorClassName="accent-muted-foreground"
        selectionColorClassName="accent-primary"
        selectionHandleColorClassName="accent-primary"
        underlineColorAndroidClassName="accent-transparent"
      />
    );
  },
);

Input.displayName = 'Input';

export { inputVariants };
