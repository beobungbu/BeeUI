import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { TextInput, View } from 'react-native';
import { Input, type InputProps } from './input';
import { Text } from './text';
import { useDirection } from './use-direction';

export type OTPInputProps = Omit<
  InputProps,
  'defaultValue' | 'inputMode' | 'keyboardType' | 'maxLength' | 'onChangeText' | 'value'
> & {
  /**
   * `'joined'` (the default, unchanged) renders one plain text field with letter-spacing —
   * no per-character caret or box. `'segmented'` renders `length` visually separate boxes
   * over the exact same single hidden input: one real caret, one value, one `onChangeText`
   * — the boxes are pure decoration, positioned over the input, never a second source of
   * truth for the code. The active (next-to-fill) box gets a focus-ring border while the
   * hidden input is focused. Reuses only existing semantic tokens (`bg-input`,
   * `border-control-border`/`border-destructive`, `border-focus-ring`).
   */
  appearance?: 'joined' | 'segmented';
  /** Initial code for uncontrolled usage; normalized (digits-only in `'numeric'` mode, truncated to `length`) like any other value. Defaults to `''`. */
  defaultValue?: string;
  /** Number of characters the code must reach before `onComplete` fires. Also sets the underlying input's `maxLength`. Defaults to 6. */
  length?: number;
  /** `'numeric'` strips non-digit characters as they are typed and shows a numeric keyboard; `'text'` accepts any character. Defaults to `'numeric'`. */
  mode?: 'numeric' | 'text';
  /** Called once when the code reaches `length` characters; not called again for the same value until it changes and comes back to full length. */
  onComplete?: (value: string) => void;
  /** Called with the normalized value on every change, including partial (incomplete) codes. */
  onValueChange?: (value: string) => void;
  /** Controlled code value; normalized (digits-only in `'numeric'` mode, truncated to `length`) before being displayed. */
  value?: string;
};

function normalizeOTP(value: string, length: number, mode: 'numeric' | 'text') {
  const normalized = mode === 'numeric' ? value.replace(/\D/g, '') : value;
  return normalized.slice(0, length);
}

export const OTPInput = React.forwardRef<React.ComponentRef<typeof TextInput>, OTPInputProps>(
  (
    {
      appearance = 'joined',
      autoCapitalize = 'none',
      autoComplete = 'one-time-code',
      autoCorrect = false,
      className,
      defaultValue = '',
      disabled,
      invalid,
      length = 6,
      mode = 'numeric',
      onBlur,
      onComplete,
      onFocus,
      onValueChange,
      spellCheck = false,
      textContentType = 'oneTimeCode',
      value,
      ...props
    },
    ref,
  ) => {
    const direction = useDirection();
    const [focused, setFocused] = React.useState(false);
    const controlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState(() =>
      normalizeOTP(defaultValue, length, mode),
    );
    const resolvedValue = normalizeOTP(controlled ? value : internalValue, length, mode);
    const lastCompletedValueRef = React.useRef<string | null>(
      resolvedValue.length === length ? resolvedValue : null,
    );

    const handleChange = (nextValue: string) => {
      const next = normalizeOTP(nextValue, length, mode);
      if (!controlled) setInternalValue(next);
      onValueChange?.(next);

      if (next.length !== length) {
        lastCompletedValueRef.current = null;
        return;
      }

      if (lastCompletedValueRef.current !== next) {
        lastCompletedValueRef.current = next;
        onComplete?.(next);
      }
    };

    const sharedInputProps = {
      autoCapitalize,
      autoComplete,
      autoCorrect,
      disabled,
      invalid,
      maxLength: length,
      onChangeText: handleChange,
      returnKeyType: 'done' as const,
      spellCheck,
      textContentType,
      value: resolvedValue,
    };

    if (appearance === 'joined') {
      return (
        <Input
          ref={ref}
          {...props}
          {...sharedInputProps}
          className={cn('text-center font-semibold tracking-[0.35em]', className)}
          inputMode={mode === 'numeric' ? 'numeric' : 'text'}
          keyboardType={mode === 'numeric' ? 'number-pad' : 'default'}
          onBlur={onBlur}
          onFocus={onFocus}
        />
      );
    }

    // `'segmented'`: `length` decorative boxes drawn behind a single input that spans the
    // whole row, its own text and caret made fully transparent — the real caret/selection
    // still lives in that one hidden input (one hidden-input contract, unchanged), only its
    // rendering is invisible. The box at `resolvedValue.length` (the next slot to fill) gets
    // the focus-ring border while the hidden input is focused, standing in for a per-cell
    // caret. `min-h-*`/`min-w-*` (not fixed `h-*`/`w-*`) let a box grow under Dynamic
    // Type/large Web zoom instead of clipping the digit inside it.
    const boxes = Array.from({ length }, (_, index) => {
      const isActive = focused && index === resolvedValue.length;
      return (
        <View
          className={cn(
            'min-h-12 min-w-11 flex-1 items-center justify-center rounded-md border bg-input',
            invalid ? 'border-destructive' : isActive ? 'border-focus-ring' : 'border-control-border',
            disabled && 'bg-disabled opacity-70',
          )}
          key={index}
        >
          <Text className="text-foreground" variant="body">
            {resolvedValue[index] ?? ''}
          </Text>
        </View>
      );
    });

    return (
      <View className={cn('relative', className)}>
        <View
          className={cn('flex-row gap-2', direction === 'rtl' && 'flex-row-reverse')}
          pointerEvents="none"
        >
          {boxes}
        </View>
        <Input
          ref={ref}
          {...props}
          {...sharedInputProps}
          caretHidden
          className="absolute inset-0 border-transparent bg-transparent text-transparent"
          inputMode={mode === 'numeric' ? 'numeric' : 'text'}
          keyboardType={mode === 'numeric' ? 'number-pad' : 'default'}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
        />
      </View>
    );
  },
);

OTPInput.displayName = 'OTPInput';
