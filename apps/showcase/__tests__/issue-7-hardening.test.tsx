import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import {
  Avatar,
  Dialog,
  DialogClose,
  DialogContent,
  PasswordInput,
  SettingsItem,
} from '@beeui/ui';

describe('BeeUI issue #7 high-confidence hardening', () => {
  it('keeps a malformed controlled Dialog dismissable at runtime', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const RuntimeDialog = Dialog as React.ComponentType<{
      children?: React.ReactNode;
      open?: boolean;
    }>;

    const screen = render(
      <RuntimeDialog open>
        <DialogContent testID="dialog-content">
          <DialogClose>Close dialog</DialogClose>
        </DialogContent>
      </RuntimeDialog>,
    );

    expect(screen.getByTestId('dialog-content')).toBeTruthy();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`open` requires `onOpenChange`'));
    fireEvent.press(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByTestId('dialog-content')).toBeNull();

    warn.mockRestore();
  });

  it('lets interactive settings rows expose description and value in their accessible name', () => {
    const onPress = jest.fn();
    const screen = render(
      <SettingsItem
        description="Manage alerts"
        onPress={onPress}
        title="Notifications"
        value="On"
      />,
    );

    const row = screen.getByRole('button', {
      name: 'Notifications, Manage alerts, On',
    });
    expect(row.props.accessibilityLabel).toBe('Notifications, Manage alerts, On');
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('hardens PasswordInput keyboard defaults even while password text is revealed', () => {
    const screen = render(<PasswordInput accessibilityLabel="Password" />);
    const password = screen.getByLabelText('Password');
    const showToggle = screen.getByRole('button', { name: 'Show password' });

    expect(password.props.autoCapitalize).toBe('none');
    expect(password.props.autoComplete).toBe('current-password');
    expect(password.props.autoCorrect).toBe(false);
    expect(password.props.spellCheck).toBe(false);
    expect(showToggle.props.className).toEqual(expect.stringContaining('w-16'));

    fireEvent.press(showToggle);
    const revealed = screen.getByLabelText('Password');
    const hideToggle = screen.getByRole('button', { name: 'Hide password' });
    expect(revealed.props.secureTextEntry).toBe(false);
    expect(revealed.props.autoCapitalize).toBe('none');
    expect(revealed.props.autoCorrect).toBe(false);
    expect(revealed.props.spellCheck).toBe(false);
    expect(hideToggle.props.className).toEqual(expect.stringContaining('w-16'));
  });

  it('preserves explicit PasswordInput autofill and keyboard overrides', () => {
    const screen = render(
      <PasswordInput
        accessibilityLabel="New password"
        autoCapitalize="words"
        autoComplete="new-password"
        autoCorrect
        spellCheck
      />,
    );
    const password = screen.getByLabelText('New password');

    expect(password.props.autoCapitalize).toBe('words');
    expect(password.props.autoComplete).toBe('new-password');
    expect(password.props.autoCorrect).toBe(true);
    expect(password.props.spellCheck).toBe(true);
  });

  it('keeps Avatar fallback stable across equivalent inline source objects and resets for a new source', () => {
    const screen = render(
      <Avatar
        fallback="BU"
        imageProps={{ testID: 'avatar-image' }}
        source={{ uri: 'https://example.com/broken.png' }}
      />,
    );

    fireEvent(screen.getByTestId('avatar-image'), 'error', { nativeEvent: {} });
    expect(screen.getByText('BU')).toBeTruthy();
    expect(screen.queryByTestId('avatar-image')).toBeNull();

    screen.rerender(
      <Avatar
        fallback="BU"
        imageProps={{ testID: 'avatar-image' }}
        source={{ uri: 'https://example.com/broken.png' }}
      />,
    );
    expect(screen.getByText('BU')).toBeTruthy();
    expect(screen.queryByTestId('avatar-image')).toBeNull();

    screen.rerender(
      <Avatar
        fallback="BU"
        imageProps={{ testID: 'avatar-image' }}
        source={{ uri: 'https://example.com/replacement.png' }}
      />,
    );
    expect(screen.getByTestId('avatar-image')).toBeTruthy();
  });
});
