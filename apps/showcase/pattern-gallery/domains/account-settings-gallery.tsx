import { useToast } from '@beemvp/beeui-ui';
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
} from '../../patterns/account-settings';
import type { PatternDemoProps, PatternDomain } from '../types';

type AppearancePreference = 'system' | 'light' | 'dark';

function ProfileDemo() {
  const toast = useToast();
  return <ProfileScreen onEditProfile={() => toast.show({ title: 'Edit profile' })} />;
}

function EditProfileDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  const [bio, setBio] = React.useState(accountProfileFixture.bio);
  const [displayName, setDisplayName] = React.useState(accountProfileFixture.displayName);
  const [email, setEmail] = React.useState(accountProfileFixture.email);
  const [username, setUsername] = React.useState(accountProfileFixture.username);

  return (
    <EditProfileScreen
      bio={bio}
      displayName={displayName}
      email={email}
      error={stateId === 'server-error' ? 'Server unavailable' : undefined}
      fieldErrors={stateId === 'invalid' ? { displayName: 'Display name is required' } : undefined}
      onBioChange={setBio}
      onChangeAvatar={() => toast.show({ title: 'Avatar picker simulated' })}
      onDisplayNameChange={setDisplayName}
      onEmailChange={setEmail}
      onSave={() => toast.show({ title: 'Profile updated', variant: 'success' })}
      onUsernameChange={setUsername}
      saving={stateId === 'saving'}
      username={username}
    />
  );
}

function SettingsDemo() {
  const toast = useToast();
  const [appearance, setAppearance] = React.useState<AppearancePreference>('system');
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);

  const cycleAppearance = () => {
    setAppearance((current) => current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system');
  };

  return (
    <SettingsScreen
      appearance={appearance}
      notificationCount={3}
      notificationsEnabled={notificationsEnabled}
      onAboutPress={() => toast.show({ title: 'About' })}
      onAccountPress={() => toast.show({ title: 'Account' })}
      onAppearancePress={cycleAppearance}
      onNotificationsEnabledChange={setNotificationsEnabled}
      onNotificationsPress={() => toast.show({ title: 'Notification settings' })}
      onPrivacyPress={() => toast.show({ title: 'Privacy & security' })}
      onSupportPress={() => toast.show({ title: 'Support' })}
    />
  );
}

function AccountDemo() {
  const toast = useToast();
  return (
    <AccountScreen
      onDeleteAccount={() => toast.show({ title: 'Delete account requested', variant: 'warning' })}
      onManageDevicesPress={() => toast.show({ title: 'Manage devices' })}
      onSignOut={() => toast.show({ title: 'Signed out' })}
    />
  );
}

function AppearanceDemo() {
  const [theme, setTheme] = React.useState<AppearancePreference>('system');
  return <AppearanceScreen onThemeChange={setTheme} theme={theme} />;
}

function NotificationSettingsDemo({ stateId }: PatternDemoProps) {
  const [activity, setActivity] = React.useState(true);
  const [email, setEmail] = React.useState(true);
  const [enabled, setEnabled] = React.useState(stateId !== 'master-off');
  const [marketing, setMarketing] = React.useState(false);
  const [push, setPush] = React.useState(true);
  const [reminders, setReminders] = React.useState(true);

  return (
    <NotificationSettingsScreen
      activity={activity}
      email={email}
      enabled={enabled}
      marketing={marketing}
      onActivityChange={setActivity}
      onEmailChange={setEmail}
      onEnabledChange={setEnabled}
      onMarketingChange={setMarketing}
      onPushChange={setPush}
      onRemindersChange={setReminders}
      push={push}
      reminders={reminders}
    />
  );
}

function PrivacySecurityDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  const [discoverable, setDiscoverable] = React.useState(true);
  const [profileVisibility, setProfileVisibility] = React.useState<'Everyone' | 'Followers' | 'Private'>('Everyone');
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(stateId !== 'two-factor-off');

  return (
    <PrivacySecurityScreen
      discoverable={discoverable}
      onBlockedUsersPress={() => toast.show({ title: 'Blocked users' })}
      onChangePasswordPress={() => toast.show({ title: 'Change password' })}
      onDiscoverableChange={setDiscoverable}
      onExportDataPress={() => toast.show({ title: 'Export requested' })}
      onManageDevicesPress={() => toast.show({ title: 'Manage devices' })}
      onProfileVisibilityPress={() => {
        setProfileVisibility((current) => current === 'Everyone' ? 'Followers' : current === 'Followers' ? 'Private' : 'Everyone');
      }}
      onRevokeOtherSessionsPress={() => toast.show({ title: 'Other sessions revoked', variant: 'success' })}
      onTwoFactorPress={() => setTwoFactorEnabled((value) => !value)}
      profileVisibility={profileVisibility}
      twoFactorEnabled={twoFactorEnabled}
    />
  );
}

function ChangePasswordDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  const [confirmPassword, setConfirmPassword] = React.useState('Newpass1');
  const [currentPassword, setCurrentPassword] = React.useState('Oldpass1');
  const [newPassword, setNewPassword] = React.useState('Newpass1');

  return (
    <ChangePasswordScreen
      confirmPassword={confirmPassword}
      currentPassword={currentPassword}
      fieldErrors={stateId === 'invalid' ? { confirmPassword: 'Passwords do not match' } : undefined}
      newPassword={newPassword}
      onConfirmPasswordChange={setConfirmPassword}
      onCurrentPasswordChange={setCurrentPassword}
      onNewPasswordChange={setNewPassword}
      onSubmit={() => toast.show({ title: 'Password update submitted' })}
      onSuccess={() => toast.show({ title: 'Password updated', variant: 'success' })}
      saving={stateId === 'saving'}
      serverError={stateId === 'server-error' ? 'Current password is incorrect' : undefined}
      success={stateId === 'success'}
    />
  );
}

export const accountSettingsPatternDomain: PatternDomain = {
  id: 'account-settings',
  title: 'Account & Settings',
  description: 'Profile editing, account preferences, appearance, notifications, privacy, and credential management.',
  screens: [
    { id: 'profile', title: 'Profile', description: 'Account identity and profile summary.', source: ProfileScreen, component: ProfileDemo },
    {
      id: 'edit-profile',
      title: 'Edit Profile',
      description: 'Controlled profile form with validation and save feedback.',
      source: EditProfileScreen,
      component: EditProfileDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'invalid', title: 'Invalid' },
        { id: 'server-error', title: 'Server error' },
        { id: 'saving', title: 'Saving' },
      ],
    },
    { id: 'settings-home', title: 'Settings Home', description: 'Settings summary with controlled appearance and notification master switch.', source: SettingsScreen, component: SettingsDemo },
    { id: 'account', title: 'Account', description: 'Account management, device access, sign-out, and destructive actions.', source: AccountScreen, component: AccountDemo },
    { id: 'appearance', title: 'Appearance', description: 'Controlled system, light, and dark preference.', source: AppearanceScreen, component: AppearanceDemo },
    {
      id: 'notification-settings',
      title: 'Notification Settings',
      description: 'Master notification preference with dependent channel switches.',
      source: NotificationSettingsScreen,
      component: NotificationSettingsDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'master-off', title: 'Master off' },
      ],
    },
    {
      id: 'privacy-security',
      title: 'Privacy & Security',
      description: 'Visibility, discovery, session, export, and two-factor controls.',
      source: PrivacySecurityScreen,
      component: PrivacySecurityDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: '2FA on' },
        { id: 'two-factor-off', title: '2FA off' },
      ],
    },
    {
      id: 'change-password',
      title: 'Change Password',
      description: 'Controlled credential form with invalid, server, saving, and success states.',
      source: ChangePasswordScreen,
      component: ChangePasswordDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'invalid', title: 'Invalid' },
        { id: 'server-error', title: 'Server error' },
        { id: 'saving', title: 'Saving' },
        { id: 'success', title: 'Success' },
      ],
    },
  ],
};
