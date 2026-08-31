import { AlertBanner, Box, Button, Field, HStack, PasswordInput, Text, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import { SettingsScreenShell } from '../components/settings-screen-shell';

export type ChangePasswordFieldErrors = Partial<
  Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>
>;

export type ChangePasswordScreenProps = {
  confirmPassword: string;
  currentPassword: string;
  fieldErrors?: ChangePasswordFieldErrors;
  newPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onSuccess?: () => void;
  saving?: boolean;
  serverError?: string;
  success?: boolean;
};

export function ChangePasswordScreen({
  confirmPassword,
  currentPassword,
  fieldErrors = {},
  newPassword,
  onConfirmPasswordChange,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onSubmit,
  onSuccess,
  saving = false,
  serverError,
  success = false,
}: ChangePasswordScreenProps) {
  const requirements = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'At least one uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'At least one number', met: /\d/.test(newPassword) },
  ];

  if (success) {
    return (
      <SettingsScreenShell
        description="The host app reported that the password was updated successfully."
        eyebrow="Security"
        testID="change-password-screen"
        title="Password updated"
      >
        <AlertBanner
          description="Your new password is active. Other session policy remains owned by the host app."
          title="Password changed"
          variant="success"
        />
        {onSuccess ? <Button onPress={onSuccess}>Done</Button> : null}
      </SettingsScreenShell>
    );
  }

  return (
    <SettingsScreenShell
      description="Use a strong password you do not reuse elsewhere. Network and authentication behavior stay outside this pattern."
      eyebrow="Security"
      keyboardAware
      testID="change-password-screen"
      title="Change password"
    >
      {serverError ? (
        <AlertBanner description={serverError} title="Password was not changed" variant="destructive" />
      ) : null}

      <VStack gap="lg">
        <Field
          error={fieldErrors.currentPassword}
          invalid={Boolean(fieldErrors.currentPassword)}
          label="Current password"
          required
        >
          <PasswordInput
            onChangeText={onCurrentPasswordChange}
            placeholder="Current password"
            value={currentPassword}
          />
        </Field>
        <Field
          error={fieldErrors.newPassword}
          invalid={Boolean(fieldErrors.newPassword)}
          label="New password"
          required
        >
          <PasswordInput
            autoComplete="new-password"
            onChangeText={onNewPasswordChange}
            placeholder="New password"
            value={newPassword}
          />
        </Field>
        <Box className="rounded-xl border border-border bg-surface-muted p-3">
          <VStack gap="xs">
            <Text tone="muted" variant="caption">
              Password requirements
            </Text>
            {requirements.map((requirement) => (
              <HStack key={requirement.label} gap="sm">
                <Text tone={requirement.met ? 'success' : 'subtle'} variant="caption">
                  {requirement.met ? '✓' : '•'}
                </Text>
                <Text tone={requirement.met ? 'default' : 'muted'} variant="caption">
                  {requirement.label}
                </Text>
              </HStack>
            ))}
          </VStack>
        </Box>
        <Field
          error={fieldErrors.confirmPassword}
          invalid={Boolean(fieldErrors.confirmPassword)}
          label="Confirm new password"
          required
        >
          <PasswordInput
            autoComplete="new-password"
            onChangeText={onConfirmPasswordChange}
            placeholder="Confirm new password"
            value={confirmPassword}
          />
        </Field>
        <Button loading={saving} onPress={onSubmit} size="lg">
          Update password
        </Button>
      </VStack>
    </SettingsScreenShell>
  );
}
