import { Badge, ListGroup, ListGroupHeader, Separator, SettingsItem, Switch } from '@beeui/ui';
import * as React from 'react';
import { SettingsScreenShell } from '../components/settings-screen-shell';
import { SettingsSection } from '../components/settings-section';
import type { AppearanceTheme } from './appearance-screen';

const appearanceLabels: Record<AppearanceTheme, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export type SettingsScreenProps = {
  appearance: AppearanceTheme;
  notificationsEnabled: boolean;
  notificationCount?: number;
  onAboutPress: () => void;
  onAccountPress: () => void;
  onAppearancePress: () => void;
  onNotificationsEnabledChange: (value: boolean) => void;
  onNotificationsPress: () => void;
  onPrivacyPress: () => void;
  onSupportPress: () => void;
};

export function SettingsScreen({
  appearance,
  notificationsEnabled,
  notificationCount = 0,
  onAboutPress,
  onAccountPress,
  onAppearancePress,
  onNotificationsEnabledChange,
  onNotificationsPress,
  onPrivacyPress,
  onSupportPress,
}: SettingsScreenProps) {
  return (
    <SettingsScreenShell
      description="Manage the parts of the product that should feel predictable, quiet, and easy to revisit."
      eyebrow="Preferences"
      testID="settings-screen"
      title="Settings"
    >
      <SettingsSection title="Account">
        <ListGroup>
          <ListGroupHeader title="Your account" description="Identity, security, and access" />
          <SettingsItem
            accessibilityLabel="Account"
            description="Profile details, devices, sign out"
            onPress={onAccountPress}
            title="Account"
            value="Manage"
          />
          <Separator />
          <SettingsItem
            accessibilityLabel="Privacy and security"
            description="Password, sessions, visibility"
            onPress={onPrivacyPress}
            title="Privacy & security"
            value="Review"
          />
        </ListGroup>
      </SettingsSection>

      <SettingsSection title="Preferences">
        <ListGroup>
          <SettingsItem
            accessibilityLabel="Appearance"
            description="System, light, or dark"
            onPress={onAppearancePress}
            title="Appearance"
            value={appearanceLabels[appearance]}
          />
        </ListGroup>
      </SettingsSection>

      <SettingsSection title="Notifications">
        <ListGroup>
          <SettingsItem
            description="Pause notification delivery without changing each channel."
            title="Allow notifications"
            trailing={
              <Switch
                accessibilityLabel="Allow notifications"
                onValueChange={onNotificationsEnabledChange}
                value={notificationsEnabled}
              />
            }
          />
          <Separator />
          <SettingsItem
            accessibilityLabel="Notification settings"
            description="Push, email, reminders, and updates"
            onPress={onNotificationsPress}
            title="Notification settings"
            trailing={
              notificationCount > 0 ? <Badge variant="primary">{notificationCount}</Badge> : undefined
            }
          />
        </ListGroup>
      </SettingsSection>

      <SettingsSection title="Support">
        <ListGroup>
          <SettingsItem
            accessibilityLabel="Help and support"
            description="Guides, contact, and troubleshooting"
            onPress={onSupportPress}
            title="Help & support"
          />
          <Separator />
          <SettingsItem
            accessibilityLabel="About"
            description="Version, legal, and acknowledgements"
            onPress={onAboutPress}
            title="About"
          />
        </ListGroup>
      </SettingsSection>
    </SettingsScreenShell>
  );
}
