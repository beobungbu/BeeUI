import { Box, HStack, ListGroup, Separator, SettingsItem, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { ProfileHeader } from '../components/profile-header';
import { SettingsScreenShell } from '../components/settings-screen-shell';
import { SettingsSection } from '../components/settings-section';
import {
  accountProfileFixture,
  profileStatsFixture,
  recentProfileActivityFixture,
  type AccountProfileFixture,
} from '../fixtures/account-fixtures';

export type ProfileScreenProps = {
  onEditProfile: () => void;
  onOpenAccount?: () => void;
  onOpenActivity?: () => void;
  profile?: AccountProfileFixture;
};

export function ProfileScreen({
  onEditProfile,
  onOpenAccount,
  onOpenActivity,
  profile = accountProfileFixture,
}: ProfileScreenProps) {
  return (
    <SettingsScreenShell
      description="A production profile surface that keeps identity, account context, and recent activity easy to scan."
      eyebrow="Profile"
      testID="profile-screen"
      title="Your profile"
    >
      <ProfileHeader
        bio={profile.bio}
        displayName={profile.displayName}
        email={profile.email}
        imageUri={profile.imageUri}
        onEditProfile={onEditProfile}
        username={profile.username}
        verified={profile.verified}
      />

      <HStack gap="sm">
        {profileStatsFixture.map((stat) => (
          <Box
            key={stat.label}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-4"
          >
            <VStack gap="xs">
              <Text variant="heading">{stat.value}</Text>
              <Text tone="muted" variant="caption">
                {stat.label}
              </Text>
            </VStack>
          </Box>
        ))}
      </HStack>

      <SettingsSection title="Profile details">
        <ListGroup>
          <SettingsItem title="Location" value={profile.location} />
          <Separator />
          <SettingsItem title="Membership" value={profile.joinedLabel} />
          {onOpenAccount ? (
            <>
              <Separator />
              <SettingsItem
                accessibilityLabel="Open account settings"
                description="Email, devices, sign out, and account deletion"
                onPress={onOpenAccount}
                title="Account settings"
                value="Manage"
              />
            </>
          ) : null}
        </ListGroup>
      </SettingsSection>

      <SettingsSection title="Recent activity">
        <ListGroup>
          {recentProfileActivityFixture.map((item, index) => (
            <React.Fragment key={item.title}>
              {index > 0 ? <Separator /> : null}
              <SettingsItem
                accessibilityLabel={onOpenActivity ? item.title : undefined}
                description={item.description}
                onPress={onOpenActivity}
                title={item.title}
                value={item.value}
              />
            </React.Fragment>
          ))}
        </ListGroup>
      </SettingsSection>
    </SettingsScreenShell>
  );
}
