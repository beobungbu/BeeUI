import {
  AlertBanner,
  Avatar,
  Box,
  Button,
  Field,
  HStack,
  Input,
  Textarea,
  VStack,
} from '@beeui/ui';
import * as React from 'react';
import { SettingsScreenShell } from '../components/settings-screen-shell';

export type EditProfileFieldErrors = Partial<
  Record<'displayName' | 'username' | 'bio' | 'email', string>
>;

export type EditProfileScreenProps = {
  bio: string;
  displayName: string;
  email: string;
  error?: string;
  fieldErrors?: EditProfileFieldErrors;
  imageUri?: string;
  onBioChange: (value: string) => void;
  onChangeAvatar: () => void;
  onDisplayNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSave: () => void;
  onUsernameChange: (value: string) => void;
  saving?: boolean;
  username: string;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

export function EditProfileScreen({
  bio,
  displayName,
  email,
  error,
  fieldErrors = {},
  imageUri,
  onBioChange,
  onChangeAvatar,
  onDisplayNameChange,
  onEmailChange,
  onSave,
  onUsernameChange,
  saving = false,
  username,
}: EditProfileScreenProps) {
  return (
    <SettingsScreenShell
      description="Keep profile fields app-controlled while BeeUI handles the form presentation and states."
      eyebrow="Profile"
      keyboardAware
      testID="edit-profile-screen"
      title="Edit profile"
    >
      <Box className="rounded-2xl border border-border bg-surface p-4">
        <HStack gap="lg">
          <Avatar
            fallback={initials(displayName)}
            size="xl"
            source={imageUri ? { uri: imageUri } : undefined}
          />
          <VStack className="min-w-0 flex-1" gap="xs">
            <Button onPress={onChangeAvatar} variant="outline">
              Change avatar
            </Button>
          </VStack>
        </HStack>
      </Box>

      {error ? (
        <AlertBanner description={error} title="Profile could not be saved" variant="destructive" />
      ) : null}

      <VStack gap="lg">
        <Field
          error={fieldErrors.displayName}
          invalid={Boolean(fieldErrors.displayName)}
          label="Display name"
          required
        >
          <Input
            onChangeText={onDisplayNameChange}
            placeholder="Your display name"
            value={displayName}
          />
        </Field>
        <Field
          description="Used in your public profile URL."
          error={fieldErrors.username}
          invalid={Boolean(fieldErrors.username)}
          label="Username"
          required
        >
          <Input
            autoCapitalize="none"
            onChangeText={onUsernameChange}
            placeholder="username"
            value={username}
          />
        </Field>
        <Field error={fieldErrors.bio} invalid={Boolean(fieldErrors.bio)} label="Bio">
          <Textarea
            maxLength={240}
            onChangeText={onBioChange}
            placeholder="A short introduction"
            value={bio}
          />
        </Field>
        <Field error={fieldErrors.email} invalid={Boolean(fieldErrors.email)} label="Email">
          <Input
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={onEmailChange}
            placeholder="you@example.com"
            value={email}
          />
        </Field>
        <Button loading={saving} onPress={onSave} size="lg">
          Save changes
        </Button>
      </VStack>
    </SettingsScreenShell>
  );
}
