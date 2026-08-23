import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import {
  AccountScreen,
  AppearanceScreen,
  ChangePasswordScreen,
  EditProfileScreen,
  NotificationSettingsScreen,
  PrivacySecurityScreen,
  ProfileScreen,
  SettingsScreen,
  accountProfileFixture,
  settingsSummaryFixture,
} from '../../patterns/account-settings';

const noop = () => undefined;

const notificationProps = {
  activity: true,
  email: true,
  enabled: true,
  marketing: false,
  onActivityChange: noop,
  onEmailChange: noop,
  onEnabledChange: noop,
  onMarketingChange: noop,
  onPushChange: noop,
  onRemindersChange: noop,
  push: true,
  reminders: true,
};

const privacyProps = {
  discoverable: true,
  onBlockedUsersPress: noop,
  onChangePasswordPress: noop,
  onDiscoverableChange: noop,
  onExportDataPress: noop,
  onManageDevicesPress: noop,
  onProfileVisibilityPress: noop,
  onRevokeOtherSessionsPress: noop,
  onTwoFactorPress: noop,
  profileVisibility: 'Everyone' as const,
  twoFactorEnabled: true,
};

const settingsCallbacks = {
  onAboutPress: noop,
  onAccountPress: noop,
  onAppearancePress: noop,
  onNotificationsEnabledChange: noop,
  onNotificationsPress: noop,
  onPrivacyPress: noop,
  onSupportPress: noop,
};

describe('account, profile, and settings pattern screens', () => {
  it('renders all eight screens without router context', () => {
    const renderings = [
      render(<ProfileScreen onEditProfile={noop} />),
      render(
        <EditProfileScreen
          bio={accountProfileFixture.bio}
          displayName={accountProfileFixture.displayName}
          email={accountProfileFixture.email}
          onBioChange={noop}
          onChangeAvatar={noop}
          onDisplayNameChange={noop}
          onEmailChange={noop}
          onSave={noop}
          onUsernameChange={noop}
          username={accountProfileFixture.username}
        />,
      ),
      render(<SettingsScreen {...settingsSummaryFixture} {...settingsCallbacks} />),
      render(
        <AccountScreen
          onDeleteAccount={noop}
          onManageDevicesPress={noop}
          onSignOut={noop}
        />,
      ),
      render(<AppearanceScreen onThemeChange={noop} theme="system" />),
      render(<NotificationSettingsScreen {...notificationProps} />),
      render(<PrivacySecurityScreen {...privacyProps} />),
      render(
        <ChangePasswordScreen
          confirmPassword=""
          currentPassword=""
          newPassword=""
          onConfirmPasswordChange={noop}
          onCurrentPasswordChange={noop}
          onNewPasswordChange={noop}
          onSubmit={noop}
        />,
      ),
    ];

    expect(renderings).toHaveLength(8);
    renderings.forEach((screen) => screen.unmount());
  });

  it('preserves edit-profile callbacks, errors, and saving state', () => {
    const onDisplayNameChange = jest.fn();
    const onChangeAvatar = jest.fn();
    const onSave = jest.fn();
    const props = {
      bio: 'Bio',
      displayName: 'Lan Tran',
      email: 'lan@example.com',
      onBioChange: noop,
      onChangeAvatar,
      onDisplayNameChange,
      onEmailChange: noop,
      onSave,
      onUsernameChange: noop,
      username: 'lantran',
    };
    const screen = render(
      <EditProfileScreen
        {...props}
        error="Server unavailable"
        fieldErrors={{ displayName: 'Display name is required' }}
      />,
    );

    expect(screen.getByText('Display name is required')).toBeTruthy();
    expect(screen.getByText('Server unavailable')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Your display name'), 'Lan T.');
    fireEvent.press(screen.getByRole('button', { name: 'Change avatar' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    expect(onDisplayNameChange).toHaveBeenCalledWith('Lan T.');
    expect(onChangeAvatar).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);

    screen.rerender(<EditProfileScreen {...props} saving />);
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save.props.accessibilityState.disabled).toBe(true);
    expect(save.props.accessibilityState.busy).toBe(true);
  });

  it('wires settings rows and master notification switch', () => {
    const onAccountPress = jest.fn();
    const onNotificationsPress = jest.fn();
    const onNotificationsEnabledChange = jest.fn();
    const screen = render(
      <SettingsScreen
        appearance="system"
        notificationsEnabled
        notificationCount={3}
        onAboutPress={noop}
        onAccountPress={onAccountPress}
        onAppearancePress={noop}
        onNotificationsEnabledChange={onNotificationsEnabledChange}
        onNotificationsPress={onNotificationsPress}
        onPrivacyPress={noop}
        onSupportPress={noop}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Account' }));
    fireEvent.press(screen.getByRole('button', { name: 'Notification settings' }));
    fireEvent(screen.getByRole('switch', { name: 'Allow notifications' }), 'valueChange', false);
    expect(onAccountPress).toHaveBeenCalledTimes(1);
    expect(onNotificationsPress).toHaveBeenCalledTimes(1);
    expect(onNotificationsEnabledChange).toHaveBeenCalledWith(false);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders the caller-supplied appearance summary and preserves its callback', () => {
    const onAppearancePress = jest.fn();
    const props = {
      ...settingsCallbacks,
      notificationsEnabled: true,
      onAppearancePress,
    };
    const screen = render(<SettingsScreen {...props} appearance="system" />);

    expect(screen.getByText('System')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Appearance' }));
    expect(onAppearancePress).toHaveBeenCalledTimes(1);

    screen.rerender(<SettingsScreen {...props} appearance="light" />);
    expect(screen.getByText('Light')).toBeTruthy();

    screen.rerender(<SettingsScreen {...props} appearance="dark" />);
    expect(screen.getByText('Dark')).toBeTruthy();
  });

  it('keeps appearance controlled for system, light, and dark', () => {
    const onThemeChange = jest.fn();
    const screen = render(<AppearanceScreen onThemeChange={onThemeChange} theme="system" />);

    fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
    expect(onThemeChange).toHaveBeenCalledWith('dark');

    screen.rerender(<AppearanceScreen onThemeChange={onThemeChange} theme="light" />);
    expect(screen.getByRole('radio', { name: 'Light' }).props.accessibilityState.checked).toBe(true);

    screen.rerender(<AppearanceScreen onThemeChange={onThemeChange} theme="dark" />);
    expect(screen.getByRole('radio', { name: 'Dark' }).props.accessibilityState.checked).toBe(true);
  });

  it('disables dependent notification switches when the master preference is off', () => {
    const onEnabledChange = jest.fn();
    const screen = render(
      <NotificationSettingsScreen {...notificationProps} enabled={false} onEnabledChange={onEnabledChange} />,
    );

    const switches = screen.getAllByRole('switch');
    expect(switches[0]?.props.accessibilityState.disabled).toBe(false);
    switches.slice(1).forEach((control) => {
      expect(control.props.accessibilityState.disabled).toBe(true);
    });

    fireEvent(switches[0]!, 'valueChange', true);
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it('wires privacy/security callbacks and represents 2FA states', () => {
    const onChangePasswordPress = jest.fn();
    const onTwoFactorPress = jest.fn();
    const onRevokeOtherSessionsPress = jest.fn();
    const screen = render(
      <PrivacySecurityScreen
        {...privacyProps}
        onChangePasswordPress={onChangePasswordPress}
        onRevokeOtherSessionsPress={onRevokeOtherSessionsPress}
        onTwoFactorPress={onTwoFactorPress}
      />,
    );

    expect(screen.getByText('On')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Change password' }));
    fireEvent.press(screen.getByRole('button', { name: 'Two-factor authentication' }));
    fireEvent.press(screen.getByRole('button', { name: 'Revoke other sessions' }));
    expect(onChangePasswordPress).toHaveBeenCalledTimes(1);
    expect(onTwoFactorPress).toHaveBeenCalledTimes(1);
    expect(onRevokeOtherSessionsPress).toHaveBeenCalledTimes(1);

    screen.rerender(<PrivacySecurityScreen {...privacyProps} twoFactorEnabled={false} />);
    expect(screen.getByText('Off')).toBeTruthy();
  });

  it('wires change-password values, invalid/server states, saving, and success callback', () => {
    const onCurrentPasswordChange = jest.fn();
    const onSubmit = jest.fn();
    const onSuccess = jest.fn();
    const props = {
      confirmPassword: 'Newpass1',
      currentPassword: 'Oldpass1',
      newPassword: 'Newpass1',
      onConfirmPasswordChange: noop,
      onCurrentPasswordChange,
      onNewPasswordChange: noop,
      onSubmit,
    };
    const screen = render(
      <ChangePasswordScreen
        {...props}
        fieldErrors={{ confirmPassword: 'Passwords do not match' }}
        serverError="Current password is incorrect"
      />,
    );

    expect(screen.getByText('Passwords do not match')).toBeTruthy();
    expect(screen.getByText('Current password is incorrect')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Current password'), 'next-old');
    fireEvent.press(screen.getByRole('button', { name: 'Update password' }));
    expect(onCurrentPasswordChange).toHaveBeenCalledWith('next-old');
    expect(onSubmit).toHaveBeenCalledTimes(1);

    screen.rerender(<ChangePasswordScreen {...props} saving />);
    const submit = screen.getByRole('button', { name: 'Update password' });
    expect(submit.props.accessibilityState.disabled).toBe(true);
    expect(submit.props.accessibilityState.busy).toBe(true);

    screen.rerender(<ChangePasswordScreen {...props} onSuccess={onSuccess} success />);
    fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('typechecks the account/settings pattern pack with its dedicated TypeScript config', () => {
    const { execFileSync } = require('child_process') as typeof import('child_process');
    const path = require('path') as typeof import('path');

    execFileSync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['exec', 'tsc', '-p', 'patterns/account-settings/tsconfig.json', '--noEmit'],
      {
        cwd: path.resolve(__dirname, '../..'),
        env: process.env,
        stdio: 'inherit',
      },
    );
  });

  it('keeps BeeUI imports public inside the pattern pack', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const root = path.resolve(__dirname, '../../patterns/account-settings');

    const readRecursively = (directory: string): string[] =>
      fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const next = path.join(directory, entry.name);
        return entry.isDirectory() ? readRecursively(next) : [next];
      });

    const source = readRecursively(root)
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/packages\/ui\/src\//);
    expect(source).not.toMatch(/packages\/core\/src\//);
    expect(source).not.toMatch(/overlay-runtime/);
    expect(source).not.toMatch(/Popover|DropdownMenu/);
  });
});
