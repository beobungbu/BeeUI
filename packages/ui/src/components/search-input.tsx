import * as React from 'react';
import { TextInput } from 'react-native';
import { Input, type InputProps } from './input';

export type SearchInputProps = Omit<InputProps, 'inputMode' | 'returnKeyType'> & {
  onSearch?: (value: string) => void;
};

export const SearchInput = React.forwardRef<React.ComponentRef<typeof TextInput>, SearchInputProps>(
  ({ clearButtonMode = 'while-editing', onSearch, onSubmitEditing, ...props }, ref) => (
    <Input
      ref={ref}
      {...props}
      clearButtonMode={clearButtonMode}
      inputMode="search"
      onSubmitEditing={(event) => {
        onSubmitEditing?.(event);
        onSearch?.(event.nativeEvent.text);
      }}
      returnKeyType="search"
    />
  ),
);

SearchInput.displayName = 'SearchInput';
