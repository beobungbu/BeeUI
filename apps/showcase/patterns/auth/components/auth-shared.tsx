import {
  AlertBanner,
  Box,
  Button,
  Card,
  HStack,
  Progress,
  Separator,
  Text,
  VStack,
} from '@beeui/ui';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

export type AuthShellProps = {
  children: React.ReactNode;
  footer?: React.ReactNode;
  compact?: boolean;
  testID?: string;
};

export function AuthShell({ children, compact = false, footer, testID }: AuthShellProps) {
  return (
    <Box className="flex-1 bg-background" testID={testID}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          <Box
            className={
              compact
                ? 'mx-auto w-full max-w-[440px] flex-1 px-5 py-6'
                : 'mx-auto w-full max-w-[440px] flex-1 px-5 py-8 web:py-12'
            }
          >
            <VStack className="flex-1" gap="xl">
              {children}
              {footer ? <Box className="mt-auto pt-4">{footer}</Box> : null}
            </VStack>
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>
    </Box>
  );
}

export type AuthHeaderProps = {
  description: string;
  eyebrow?: string;
  title: string;
};

export function AuthHeader({ description, eyebrow = 'BeeUI', title }: AuthHeaderProps) {
  return (
    <VStack gap="lg">
      <HStack gap="sm">
        <Box
          accessibilityLabel="BeeUI"
          className="h-10 w-10 items-center justify-center rounded-xl bg-primary"
        >
          <Text className="text-primary-foreground" variant="heading">
            B
          </Text>
        </Box>
        <VStack gap="none" justify="center">
          <Text tone="muted" variant="caption">
            {eyebrow}
          </Text>
          <Text variant="label">Account</Text>
        </VStack>
      </HStack>

      <VStack gap="sm">
        <Text className="text-3xl leading-10" variant="title">
          {title}
        </Text>
        <Text tone="muted" variant="body">
          {description}
        </Text>
      </VStack>
    </VStack>
  );
}

export function AuthDivider({ label = 'or continue with' }: { label?: string }) {
  return (
    <HStack align="center" gap="md">
      <Separator className="flex-1" />
      <Text tone="subtle" variant="caption">
        {label}
      </Text>
      <Separator className="flex-1" />
    </HStack>
  );
}

export type SocialAuthActionsProps = {
  disabled?: boolean;
  onAppleSignIn?: () => void;
  onGoogleSignIn?: () => void;
};

export function SocialAuthActions({
  disabled = false,
  onAppleSignIn,
  onGoogleSignIn,
}: SocialAuthActionsProps) {
  if (!onAppleSignIn && !onGoogleSignIn) return null;

  return (
    <VStack gap="sm">
      <AuthDivider />
      {onGoogleSignIn ? (
        <Button disabled={disabled} onPress={onGoogleSignIn} size="lg" variant="outline">
          Continue with Google
        </Button>
      ) : null}
      {onAppleSignIn ? (
        <Button disabled={disabled} onPress={onAppleSignIn} size="lg" variant="outline">
          Continue with Apple
        </Button>
      ) : null}
    </VStack>
  );
}

export type OnboardingProgressProps = {
  current: number;
  label?: string;
  total: number;
};

export function OnboardingProgress({ current, label = 'Profile setup', total }: OnboardingProgressProps) {
  const safeTotal = Math.max(total, 1);
  const safeCurrent = Math.min(Math.max(current, 0), safeTotal);

  return (
    <VStack gap="sm">
      <HStack justify="between">
        <Text tone="muted" variant="caption">
          {label}
        </Text>
        <Text tone="muted" variant="caption">
          {safeCurrent} of {safeTotal}
        </Text>
      </HStack>
      <Progress max={safeTotal} size="sm" value={safeCurrent} />
    </VStack>
  );
}

export type PasswordRequirement = {
  label: string;
  met: boolean;
};

export function PasswordRequirements({
  requirements,
}: {
  requirements: PasswordRequirement[];
}) {
  return (
    <Card padding="sm" variant="muted">
      <VStack gap="xs">
        <Text tone="muted" variant="caption">
          Password requirements
        </Text>
        {requirements.map((requirement) => (
          <HStack key={requirement.label} gap="sm">
            <Text
              accessibilityLabel={requirement.met ? 'Requirement met' : 'Requirement not met'}
              tone={requirement.met ? 'success' : 'subtle'}
              variant="caption"
            >
              {requirement.met ? '✓' : '•'}
            </Text>
            <Text tone={requirement.met ? 'default' : 'muted'} variant="caption">
              {requirement.label}
            </Text>
          </HStack>
        ))}
      </VStack>
    </Card>
  );
}

export function ServerError({
  error,
  title = 'Something went wrong',
}: {
  error?: string;
  title?: string;
}) {
  if (!error) return null;

  return <AlertBanner description={error} title={title} variant="destructive" />;
}
