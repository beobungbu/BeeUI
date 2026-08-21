import * as React from 'react';
import { TextInput } from 'react-native';
import { Input, type InputProps } from './input';

export type SearchInputProps = Omit<InputProps, 'inputMode' | 'returnKeyType'> & {
  onSearch?: (value: string) => void;
};

export const SearchInput = React.forwardRef<React.ComponentRef<typeof TextInput>, SearchInputProps>(
  (
    {
      clearButtonMode = 'while-editing',
      defaultValue,
      onChangeText,
      onSearch,
      onSubmitEditing,
      value,
      ...props
    },
    ref,
  ) => {
    const lastTextRef = React.useRef(value ?? defaultValue ?? '');

    React.useEffect(() => {
      if (typeof value === 'string') lastTextRef.current = value;
    }, [value]);

    return (
      <Input
        ref={ref}
        {...props}
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
  },
);

SearchInput.displayName = 'SearchInput';
