import { Badge, ListGroup, Separator, SettingsItem } from '@beeui/ui';
import * as React from 'react';
import { PreferenceRow } from '../components/preference-row';
import { SettingsScreenShell } from '../components/settings-screen-shell';
import { SettingsSection } from '../components/settings-section';

export type PrivacySecurityScreenProps = {
  discoverable: boolean;
  onBlockedUsersPress: () => void;
  onChangePasswordPress: () => void;
  onDiscoverableChange: (value: boolean) => void;
  onExportDataPress: () => void;
  onManageDevicesPress: () => void;
  onProfileVisibilityPress: () => void;
  onRevokeOtherSessionsPress: () => void;
  onTwoFactorPress: () => void;
  profileVisibility: 'Everyone' | 'Followers' | 'Private';
  twoFactorEnabled: boolean;
};

export function PrivacySecurityScreen({
  discoverable,
  onBlockedUsersPress,
  onChangePasswordPress,
  onDiscoverableChange,
  onExportDataPress,
  onManageDevicesPress,
  onProfileVisibilityPress,
  onRevokeOtherSessionsPress,
  onTwoFactorPress,
  profileVisibility,
  twoFactorEnabled,
}: PrivacySecurityScreenProps) {
  return (
    <SettingsScreenShell
      description="Security status, session controls, and privacy preferences stay explicit without embedding backend behavior."
      eyebrow="Settings"
      testID="privacy-security-screen"
      title="Privacy & security"
    >
      <SettingsSection title="Security">
        <ListGroup>
          <SettingsItem
            accessibilityLabel="Change password"
            description="Update your account password"
            onPress={onChangePasswordPress}
            title="Password"
            value="Change"
          />
          <Separator />
          <SettingsItem
            accessibilityLabel="Two-factor authentication"
            description="Add a second verification step at sign in"
            onPress={onTwoFactorPress}
            title="Two-factor authentication"
            trailing={
              <Badge variant={twoFactorEnabled ? 'success' : 'outline'}>
                {twoFactorEnabled ? 'On' : 'Off'}
              </Badge>
            }
          />
          <Separator />
          <SettingsItem
            accessibilityLabel="Manage devices and sessions"
            description="Review where your account is signed in"
            onPress={onManageDevicesPress}
            title="Devices & sessions"
            value="3 active"
          />
        </ListGroup>
      </SettingsSection>

      <SettingsSection title="Privacy">
        <ListGroup>
          <SettingsItem
            accessibilityLabel="Profile visibility"
            description="Control who can see your profile"
            onPress={onProfileVisibilityPress}
            title="Profile visibility"
            value={profileVisibility}
          />
          <Separator />
          <PreferenceRow
            description="Allow your profile to appear in recommendations and search."
            onValueChange={onDiscoverableChange}
            title="Discoverable profile"
            value={discoverable}
          />
          <Separator />
          <SettingsItem
            accessibilityLabel="Blocked users"
            onPress={onBlockedUsersPress}
            title="Blocked users"
            value="Review"
          />
          <Separator />
          <SettingsItem
            accessibilityLabel="Export data"
            description="Request a portable copy of your account data"
            onPress={onExportDataPress}
            title="Export data"
          />
        </ListGroup>
      </SettingsSection>

      <SettingsSection
        description="Revocation remains app-owned and should normally use a confirmation flow."
        title="Session controls"
      >
        <ListGroup>
          <SettingsItem
            accessibilityLabel="Revoke other sessions"
            description="Sign out every device except this one"
            onPress={onRevokeOtherSessionsPress}
            title="Revoke other sessions"
          />
        </ListGroup>
      </SettingsSection>
    </SettingsScreenShell>
  );
}
