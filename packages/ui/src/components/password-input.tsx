import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { TextInput } from 'react-native';
import { Box } from './box';
import { Button } from './button';
import { Input, type InputProps } from './input';

export type PasswordInputProps = Omit<InputProps, 'secureTextEntry'> & {
  containerClassName?: string;
  /** Initial visibility for uncontrolled usage. Defaults to false (masked). */
  defaultVisible?: boolean;
  /** Accessible label for the toggle button when the password is currently visible (pressing it hides it). Defaults to `'Hide password'`. */
  hideLabel?: string;
  /** Called with the next visibility whenever the show/hide toggle is pressed. */
  onVisibleChange?: (visible: boolean) => void;
  /** Accessible label for the toggle button when the password is currently masked (pressing it shows it). Defaults to `'Show password'`. */
  showLabel?: string;
  /** Applied to the show/hide toggle `Button`, not the input. */
  toggleClassName?: string;
  /** Controls whether the password is shown in plain text (`true`) or masked via `secureTextEntry` (`false`). Passing this switches visibility to controlled mode. */
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
          className={cn('w-16 shrink-0 px-3', toggleClassName)}
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
