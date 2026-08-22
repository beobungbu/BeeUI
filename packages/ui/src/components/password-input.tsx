import { cn } from '@beeui/core';
import * as React from 'react';
import { TextInput } from 'react-native';
import { Box } from './box';
import { Button } from './button';
import { Input, type InputProps } from './input';

export type PasswordInputProps = Omit<InputProps, 'secureTextEntry'> & {
  containerClassName?: string;
  defaultVisible?: boolean;
  hideLabel?: string;
  onVisibleChange?: (visible: boolean) => void;
  showLabel?: string;
  toggleClassName?: string;
  visible?: boolean;
};

export const PasswordInput = React.forwardRef<
  React.ComponentRef<typeof TextInput>,
  PasswordInputProps
>(
  (
    {
      autoCapitalize = 'none',
      autoComplete,
      autoCorrect = false,
      className,
      containerClassName,
      defaultVisible = false,
      hideLabel = 'Hide password',
      onVisibleChange,
      showLabel = 'Show password',
      spellCheck = false,
      textContentType,
      toggleClassName,
      visible,
      ...props
    },
    ref,
  ) => {
    const controlled = visible !== undefined;
    const [internalVisible, setInternalVisible] = React.useState(defaultVisible);
    const resolvedVisible = controlled ? visible : internalVisible;
    const toggleLabel = resolvedVisible ? hideLabel : showLabel;
    const resolvedAutoComplete = autoComplete ?? (textContentType ? undefined : 'current-password');

    const toggle = () => {
      const next = !resolvedVisible;
      if (!controlled) setInternalVisible(next);
      onVisibleChange?.(next);
    };

    return (
      <Box className={cn('w-full flex-row items-center gap-2', containerClassName)}>
        <Input
          ref={ref}
          {...props}
          autoCapitalize={autoCapitalize}
          autoComplete={resolvedAutoComplete}
          autoCorrect={autoCorrect}
          className={cn('min-w-0 flex-1 w-auto', className)}
          secureTextEntry={!resolvedVisible}
          spellCheck={spellCheck}
          textContentType={textContentType}
        />
        <Button
          accessibilityLabel={toggleLabel}
          className={cn('w-16 shrink-0 px-0', toggleClassName)}
          onPress={toggle}
          size="md"
          variant="outline"
        >
          {resolvedVisible ? 'Hide' : 'Show'}
        </Button>
      </Box>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
