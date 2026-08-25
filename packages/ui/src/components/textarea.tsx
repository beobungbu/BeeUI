import { cn } from '@beeui/core';
import * as React from 'react';
import { TextInput } from 'react-native';
import { Input, type InputProps } from './input';

export type TextareaProps = Omit<InputProps, 'multiline' | 'size'>;

export const Textarea = React.forwardRef<React.ComponentRef<typeof TextInput>, TextareaProps>(
  ({ className, numberOfLines = 4, textAlignVertical = 'top', ...props }, ref) => (
    <Input
      ref={ref}
      {...props}
      className={cn(
        // RN Web no longer derives the previous 4-row intrinsic height from the semantic font utility.
        // Preserve the canonical 4 x 24px line box + 24px vertical padding + 2px border on web only.
        'h-auto min-h-24 web:min-h-[122px] py-3',
        className,
      )}
      multiline
      numberOfLines={numberOfLines}
      size="md"
      textAlignVertical={textAlignVertical}
    />
  ),
);

Textarea.displayName = 'Textarea';
