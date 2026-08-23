import { ListGroup, Separator, SettingsItem, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { AccountSummary } from '../components/account-summary';
import { DangerZone } from '../components/danger-zone';
import { SettingsScreenShell } from '../components/settings-screen-shell';
import { SettingsSection } from '../components/settings-section';
import { accountProfileFixture, type AccountProfileFixture } from '../fixtures/account-fixtures';

export type AccountScreenProps = {
  onDeleteAccount: () => void;
  onLinkedAccountsPress?: () => void;
  onManageDevicesPress: () => void;
  onSignOut: () => void;
  profile?: AccountProfileFixture;
  status?: 'active' | 'limited' | 'pending';
};

export function AccountScreen({
  onDeleteAccount,
  onLinkedAccountsPress,
  onManageDevicesPress,
  onSignOut,
  profile = accountProfileFixture,
  status = 'active',
}: AccountScreenProps) {
  return (
    <SettingsScreenShell
      description="Identity and access controls are grouped separately from destructive account actions."
      eyebrow="Settings"
      testID="account-screen"
      title="Account"
    >
      <AccountSummary
        displayName={profile.displayName}
        email={profile.email}
        phone={profile.phone}
        status={status}
        username={profile.username}
      />

      <SettingsSection title="Access">
        <ListGroup>
          <SettingsItem
            accessibilityLabel="Manage devices"
            description="Review signed-in devices and sessions"
            onPress={onManageDevicesPress}
            title="Devices & sessions"
            value="3 active"
          />
          {onLinkedAccountsPress ? (
            <>
              <Separator />
              <SettingsItem
                accessibilityLabel="Linked accounts"
                description="Connected sign-in providers"
                onPress={onLinkedAccountsPress}
                title="Linked accounts"
                value="2"
              />
            </>
          ) : null}
        </ListGroup>
      </SettingsSection>

      <SettingsSection title="Session">
        <ListGroup>
          <SettingsItem
            accessibilityLabel="Sign out"
            description="Sign out of this device only"
            onPress={onSignOut}
            title="Sign out"
          />
        </ListGroup>
      </SettingsSection>

      <VStack gap="sm">
        <Text variant="heading">Danger zone</Text>
        <DangerZone
          description="This only exposes the destructive intent. The host app must own confirmation, network calls, and recovery behavior."
          onPress={onDeleteAccount}
          title="Delete account"
        />
      </VStack>
    </SettingsScreenShell>
  );
}
