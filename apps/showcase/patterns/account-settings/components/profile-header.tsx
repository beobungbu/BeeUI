import { Avatar, Badge, Box, Button, HStack, Text, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';

export type ProfileHeaderProps = {
  bio?: string;
  displayName: string;
  email: string;
  imageUri?: string;
  onEditProfile?: () => void;
  username: string;
  verified?: boolean;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

export function ProfileHeader({
  bio,
  displayName,
  email,
  imageUri,
  onEditProfile,
  username,
  verified = false,
}: ProfileHeaderProps) {
  return (
    <Box className="rounded-2xl border border-border bg-surface p-5 web:p-6">
      <VStack gap="lg">
        <HStack align="start" gap="lg">
          <Avatar
            accessibilityLabel={`${displayName} avatar`}
            accessible
            fallback={initials(displayName)}
            size="xl"
            source={imageUri ? { uri: imageUri } : undefined}
          />
          <VStack className="min-w-0 flex-1" gap="xs">
            <HStack gap="sm" wrap>
              <Text className="min-w-0" variant="heading">
                {displayName}
              </Text>
              {verified ? <Badge variant="success">Verified</Badge> : null}
            </HStack>
            <Text tone="muted" variant="caption">
              @{username} · {email}
            </Text>
            {bio ? (
              <Text className="pt-1" tone="muted" variant="body">
                {bio}
              </Text>
            ) : null}
          </VStack>
        </HStack>
        {onEditProfile ? (
          <Button onPress={onEditProfile} variant="outline">
            Edit profile
          </Button>
        ) : null}
      </VStack>
    </Box>
  );
}
