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
      className={cn('h-auto min-h-24 py-3', className)}
      multiline
      numberOfLines={numberOfLines}
      size="md"
      textAlignVertical={textAlignVertical}
    />
  ),
);

Textarea.displayName = 'Textarea';
