import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { Platform, TextInput } from 'react-native';
import { Input, type InputProps } from './input';

export type TextareaProps = Omit<InputProps, 'multiline' | 'size'>;

const TEXTAREA_WEB_MIN_HEIGHT = 96;
const TEXTAREA_WEB_BODY_LINE_HEIGHT = 24;
const TEXTAREA_WEB_VERTICAL_CHROME = 26;

export function getTextareaWebMinHeight(numberOfLines: number) {
  return Math.max(
    TEXTAREA_WEB_MIN_HEIGHT,
    numberOfLines * TEXTAREA_WEB_BODY_LINE_HEIGHT + TEXTAREA_WEB_VERTICAL_CHROME,
  );
}

export const Textarea = React.forwardRef<React.ComponentRef<typeof TextInput>, TextareaProps>(
  ({ className, numberOfLines = 4, style, textAlignVertical = 'top', ...props }, ref) => (
    <Input
      ref={ref}
      {...props}
      className={cn('h-auto min-h-24 py-3', className)}
      multiline
      numberOfLines={numberOfLines}
      size="md"
      style={[
        Platform.OS === 'web' ? { minHeight: getTextareaWebMinHeight(numberOfLines) } : undefined,
        style,
      ]}
      textAlignVertical={textAlignVertical}
    />
  ),
);

Textarea.displayName = 'Textarea';
