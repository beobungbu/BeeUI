import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { TextInput } from 'react-native';
import { Box } from './box';
import { Input, type InputProps } from './input';

export type SearchInputProps = Omit<InputProps, 'inputMode' | 'returnKeyType'> & {
  /** Applied to the row wrapping the input and `trailing`; ignored when `trailing` is omitted (the input then renders with no extra wrapper, unchanged). */
  containerClassName?: string;
  /** Called with the submitted text when the return key is pressed, and with `''` when the text is cleared back to empty after having had content. Not called for every keystroke — use `onChangeText` for that. */
  onSearch?: (value: string) => void;
  /** Rendered after the input, outside it (e.g. a scan-glyph button or a keyboard-shortcut hint). Forward a ref (`React.ComponentRef<typeof TextInput>`) to this component and call `ref.current.focus()` to focus the field from it. */
  trailing?: React.ReactNode;
};

export const SearchInput = React.forwardRef<React.ComponentRef<typeof TextInput>, SearchInputProps>(
  (
    {
      className,
      clearButtonMode = 'while-editing',
      containerClassName,
      defaultValue,
      onChangeText,
      onSearch,
      onSubmitEditing,
      trailing,
      value,
      ...props
    },
    ref,
  ) => {
    const lastTextRef = React.useRef(value ?? defaultValue ?? '');

    React.useEffect(() => {
      if (typeof value === 'string') lastTextRef.current = value;
    }, [value]);

    const input = (
      <Input
        ref={ref}
        {...props}
        className={cn(trailing ? 'min-w-0 flex-1' : undefined, className)}
        clearButtonMode={clearButtonMode}
        defaultValue={defaultValue}
        inputMode="search"
        onChangeText={(text) => {
          const previousText = lastTextRef.current;
          lastTextRef.current = text;
          onChangeText?.(text);
          if (previousText.length > 0 && text.length === 0) onSearch?.('');
        }}
        onSubmitEditing={(event) => {
          onSubmitEditing?.(event);
          onSearch?.(event.nativeEvent.text);
        }}
        returnKeyType="search"
        value={value}
      />
    );

    if (!trailing) return input;

    return (
      <Box className={cn('w-full flex-row items-center gap-2', containerClassName)}>
        {input}
        {trailing}
      </Box>
    );
  },
);

SearchInput.displayName = 'SearchInput';
