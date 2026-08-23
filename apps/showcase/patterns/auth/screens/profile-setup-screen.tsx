import {
  AlertBanner,
  Avatar,
  Button,
  Card,
  Field,
  Input,
  Link,
  Textarea,
  VStack,
} from '@beeui/ui';
import * as React from 'react';
import { AuthShell, OnboardingProgress, ServerError } from '../components/auth-shared';

export type ProfileSetupFieldErrors = {
  bio?: string;
  displayName?: string;
  username?: string;
};

export type ProfileSetupScreenProps = {
  avatarUri?: string;
  bio?: string;
  currentStep?: number;
  disabled?: boolean;
  displayName: string;
  error?: string;
  fieldErrors?: ProfileSetupFieldErrors;
  loading?: boolean;
  onBack?: () => void;
  onBioChange?: (value: string) => void;
  onChangePhoto?: () => void;
  onDisplayNameChange: (value: string) => void;
  onSkip?: () => void;
  onSubmit: () => void;
  onUsernameChange?: (value: string) => void;
  totalSteps?: number;
  username?: string;
};

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'BU';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function ProfileSetupScreen({
  avatarUri,
  bio = '',
  currentStep = 2,
  disabled = false,
  displayName,
  error,
  fieldErrors = {},
  loading = false,
  onBack,
  onBioChange,
  onChangePhoto,
  onDisplayNameChange,
  onSkip,
  onSubmit,
  onUsernameChange,
  totalSteps = 2,
  username = '',
}: ProfileSetupScreenProps) {
  const blocked = disabled || loading;

  return (
    <AuthShell compact testID="profile-setup-screen">
      <OnboardingProgress current={currentStep} label="Profile setup" total={totalSteps} />

      <VStack gap="sm">
        <VStack align="center" gap="sm">
          <Avatar
            fallback={initialsFor(displayName)}
            size="xl"
            source={avatarUri ? { uri: avatarUri } : undefined}
          />
          {onChangePhoto ? (
            <Button disabled={blocked} onPress={onChangePhoto} size="sm" variant="ghost">
              Change photo
            </Button>
          ) : null}
        </VStack>

        <VStack gap="xs">
          <AlertBanner
            description="You can update these details later from account settings."
            live="none"
            title="Finish your profile"
            variant="info"
          />
        </VStack>
      </VStack>

      <ServerError error={error} title="Unable to save profile" />

      <Card padding="lg" variant="raised">
        <VStack gap="lg">
          <Field
            error={fieldErrors.displayName}
            invalid={Boolean(fieldErrors.displayName)}
            label="Display name"
            required
          >
            <Input
              autoComplete="name"
              disabled={blocked}
              onChangeText={onDisplayNameChange}
              placeholder="How should we call you?"
              value={displayName}
            />
          </Field>

          {onUsernameChange ? (
            <Field
              description="Optional. You can change this later."
              error={fieldErrors.username}
              invalid={Boolean(fieldErrors.username)}
              label="Username"
            >
              <Input
                autoCapitalize="none"
                autoCorrect={false}
                disabled={blocked}
                onChangeText={onUsernameChange}
                placeholder="your-handle"
                value={username}
              />
            </Field>
          ) : null}

          {onBioChange ? (
            <Field
              error={fieldErrors.bio}
              invalid={Boolean(fieldErrors.bio)}
              label="Short bio"
            >
              <Textarea
                disabled={blocked}
                maxLength={160}
                onChangeText={onBioChange}
                placeholder="A sentence about you"
                value={bio}
              />
            </Field>
          ) : null}

          <Button disabled={disabled || displayName.trim().length === 0} loading={loading} onPress={onSubmit} size="lg">
            Finish profile
          </Button>
        </VStack>
      </Card>

      <VStack align="center" gap="sm">
        {onBack ? (
          <Link className="self-center" disabled={blocked} onPress={onBack}>
            Back
          </Link>
        ) : null}
        {onSkip ? (
          <Link className="self-center" disabled={blocked} onPress={onSkip}>
            Skip for now
          </Link>
        ) : null}
      </VStack>
    </AuthShell>
  );
}
