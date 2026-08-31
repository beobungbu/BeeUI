import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { TextInput } from 'react-native';
import { Input, type InputProps } from './input';

export type OTPInputProps = Omit<
  InputProps,
  'defaultValue' | 'inputMode' | 'keyboardType' | 'maxLength' | 'onChangeText' | 'value'
> & {
  defaultValue?: string;
  length?: number;
  mode?: 'numeric' | 'text';
  onComplete?: (value: string) => void;
  onValueChange?: (value: string) => void;
  value?: string;
};

function normalizeOTP(value: string, length: number, mode: 'numeric' | 'text') {
  const normalized = mode === 'numeric' ? value.replace(/\D/g, '') : value;
  return normalized.slice(0, length);
}

export const OTPInput = React.forwardRef<React.ComponentRef<typeof TextInput>, OTPInputProps>(
  (
    {
      autoCapitalize = 'none',
      autoComplete = 'one-time-code',
      autoCorrect = false,
      className,
      defaultValue = '',
      length = 6,
      mode = 'numeric',
      onComplete,
      onValueChange,
      spellCheck = false,
      textContentType = 'oneTimeCode',
      value,
      ...props
    },
    ref,
  ) => {
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

    return (
      <Input
        ref={ref}
        {...props}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        className={cn('text-center font-semibold tracking-[0.35em]', className)}
        inputMode={mode === 'numeric' ? 'numeric' : 'text'}
        keyboardType={mode === 'numeric' ? 'number-pad' : 'default'}
        maxLength={length}
        onChangeText={handleChange}
        returnKeyType="done"
        spellCheck={spellCheck}
        textContentType={textContentType}
        value={resolvedValue}
      />
    );
  },
);

OTPInput.displayName = 'OTPInput';
