import { cn } from '@beemvp/beeui-core';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import { useFieldContext } from './field-context';
import { useFormGroupContext } from './form-group-context';
import { Text } from './text';
import { useRequiredCallbackWarning } from './use-required-callback-warning';

const checkboxIndicatorVariants = cva(
  'h-5 w-5 shrink-0 items-center justify-center rounded-sm border',
  {
    variants: {
      state: {
        unchecked: 'border-border-strong bg-input',
        checked: 'border-primary bg-primary',
        indeterminate: 'border-primary bg-primary',
      },
      disabled: {
        true: 'border-disabled bg-disabled',
        false: '',
      },
    },
    defaultVariants: {
      state: 'unchecked',
      disabled: false,
    },
  },
);

export type CheckboxValue = boolean | 'indeterminate';

export type CheckboxProps = Omit<
  PressableProps,
  'accessibilityRole' | 'role' | 'children' | 'onPress'
> & {
  /** The checkbox's state: `true` (checked), `false` (unchecked), or `'indeterminate'` (a dash, e.g. a "select all" with a partial selection). Always controlled by the caller; defaults to `false`. */
  checked?: CheckboxValue;
  className?: string;
  /** Applied to the checkbox's own box, not its label. */
  indicatorClassName?: string;
  label?: string;
  labelClassName?: string;
  /** Called with the next checked state (`true`/`false`, never `'indeterminate'`) when pressed. Toggles from `'indeterminate'` to `true`. */
  onCheckedChange?: (checked: boolean) => void;
};

export const Checkbox = React.forwardRef<React.ComponentRef<typeof Pressable>, CheckboxProps>(
  (
    {
      accessibilityHint,
      accessibilityLabel,
      accessibilityLabelledBy,
      accessibilityState,
      checked = false,
      className,
      disabled = false,
      indicatorClassName,
      label,
      labelClassName,
      onCheckedChange,
      ...props
    },
    ref,
  ) => {
    // A Checkbox rendered as `Field`/`FormGroup` `children` (with no own
    // `label`/`accessibilityLabel`/`accessibilityLabelledBy`) picks up the
    // enclosing Field's label association and the enclosing FormGroup's
    // error/description hint, the same way `Input`/`RadioGroup` already do —
    // a Checkbox with its own `label` (the common single-checkbox pattern)
    // keeps that as its accessible name unchanged.
    const field = useFieldContext();
    const formGroup = useFormGroupContext();
    const isDisabled = disabled === true || field?.disabled === true || formGroup?.disabled === true;
    const state = checked === 'indeterminate' ? 'indeterminate' : checked ? 'checked' : 'unchecked';
    const accessibilityChecked = checked === 'indeterminate' ? 'mixed' : checked;
    const hasOwnAccessibleName = accessibilityLabel !== undefined || label !== undefined;
    const resolvedAccessibilityLabelledBy =
      accessibilityLabelledBy ?? (hasOwnAccessibleName ? undefined : field?.labelNativeID);
    const inheritedHint = field
      ? field.invalid && field.error
        ? field.error
        : field.description
      : formGroup?.invalid && formGroup.error
        ? formGroup.error
        : formGroup?.description;
    // No hardcoded English "required" copy in the fallback name — only a
    // caller-supplied, localized `Field.requiredLabel` is appended; otherwise
    // `required` reaches assistive tech solely through `aria-required` below.
    const fallbackFieldLabel =
      !hasOwnAccessibleName && field && field.required && field.requiredLabel
        ? `${field.label}, ${field.requiredLabel}`
        : field?.label;

    useRequiredCallbackWarning('Checkbox', 'onCheckedChange', onCheckedChange, isDisabled);

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityHint={accessibilityHint ?? inheritedHint}
        accessibilityLabel={accessibilityLabel ?? label ?? fallbackFieldLabel}
        accessibilityLabelledBy={resolvedAccessibilityLabelledBy}
        accessibilityRole="checkbox"
        accessibilityState={{
          ...accessibilityState,
          checked: accessibilityChecked,
          disabled: isDisabled,
        }}
        // `accessibilityState` alone does not reach the DOM on react-native-web
        // (it is not in its forwarded-props allowlist), so `role="checkbox"`
        // would otherwise render without the required `aria-checked`. Setting
        // the web-native `aria-checked` prop directly keeps native platforms
        // (which read `accessibilityState`) and Web (which reads `aria-*`) both correct.
        aria-checked={accessibilityChecked}
        // `required` reaches the DOM via `aria-required` rather than
        // injected text (RN's compound `accessibilityState` has no `required`
        // key) — from the enclosing `Field` when present, otherwise from the
        // enclosing `FormGroup` (a checkbox list's own group-level required
        // state, e.g. "select at least one").
        aria-required={(field?.required ?? formGroup?.required) || undefined}
        className={cn('flex-row items-center gap-3 active:opacity-80', className)}
        disabled={isDisabled}
        onPress={() => onCheckedChange?.(checked !== true)}
      >
        <View
          accessible={false}
          className={cn(
            checkboxIndicatorVariants({ disabled: isDisabled, state }),
            indicatorClassName,
          )}
          pointerEvents="none"
        >
          {checked === true ? (
            <Text
              className={cn(
                'text-xs font-bold text-primary-foreground',
                isDisabled && 'text-disabled-foreground',
              )}
            >
              ✓
            </Text>
          ) : null}
          {checked === 'indeterminate' ? (
            <Text
              className={cn(
                'text-sm font-bold leading-4 text-primary-foreground',
                isDisabled && 'text-disabled-foreground',
              )}
            >
              −
            </Text>
          ) : null}
        </View>
        {label ? (
          <Text
            className={cn(isDisabled && 'text-disabled-foreground', labelClassName)}
            variant="body"
          >
            {label}
          </Text>
        ) : null}
      </Pressable>
    );
  },
);

Checkbox.displayName = 'Checkbox';

export { checkboxIndicatorVariants };
