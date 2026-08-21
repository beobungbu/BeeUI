import { cn } from '@beeui/core';
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
      autoComplete = 'one-time-code',
      className,
      defaultValue = '',
      length = 6,
      mode = 'numeric',
      onComplete,
      onValueChange,
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

    const handleChange = (nextValue: string) => {
      const next = normalizeOTP(nextValue, length, mode);
      if (!controlled) setInternalValue(next);
      onValueChange?.(next);
      if (next.length === length) onComplete?.(next);
    };

    return (
      <Input
        ref={ref}
        {...props}
        autoComplete={autoComplete}
        className={cn('text-center font-semibold tracking-[0.35em]', className)}
        inputMode={mode === 'numeric' ? 'numeric' : 'text'}
        keyboardType={mode === 'numeric' ? 'number-pad' : 'default'}
        maxLength={length}
        onChangeText={handleChange}
        returnKeyType="done"
        textContentType={textContentType}
        value={resolvedValue}
      />
    );
  },
);

OTPInput.displayName = 'OTPInput';
