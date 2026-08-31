import { Button, Card, Field, PasswordInput, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import {
  AuthHeader,
  AuthShell,
  PasswordRequirements,
  ServerError,
  type PasswordRequirement,
} from '../components/auth-shared';
import { getPasswordRequirements } from '../fixtures/auth-fixtures';

export type ResetPasswordScreenProps = {
  confirmPassword: string;
  confirmPasswordError?: string;
  disabled?: boolean;
  error?: string;
  loading?: boolean;
  onConfirmPasswordChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  password: string;
  passwordError?: string;
  passwordRequirements?: PasswordRequirement[];
};

export function ResetPasswordScreen({
  confirmPassword,
  confirmPasswordError,
  disabled = false,
  error,
  loading = false,
  onConfirmPasswordChange,
  onPasswordChange,
  onSubmit,
  password,
  passwordError,
  passwordRequirements,
}: ResetPasswordScreenProps) {
  const blocked = disabled || loading;
  const requirements = passwordRequirements ?? getPasswordRequirements(password);

  return (
    <AuthShell testID="reset-password-screen">
      <AuthHeader
        description="Choose a new password that is strong, memorable, and different from your previous one."
        title="Create a new password"
      />

      <ServerError error={error} title="Unable to update password" />

      <Card padding="lg" variant="raised">
        <VStack gap="lg">
          <Field error={passwordError} invalid={Boolean(passwordError)} label="New password" required>
            <PasswordInput
              autoComplete="new-password"
              disabled={blocked}
              onChangeText={onPasswordChange}
              placeholder="New password"
              textContentType="newPassword"
              value={password}
            />
          </Field>

          <PasswordRequirements requirements={requirements} />

          <Field
            error={confirmPasswordError}
            invalid={Boolean(confirmPasswordError)}
            label="Confirm new password"
            required
          >
            <PasswordInput
              autoComplete="new-password"
              disabled={blocked}
              onChangeText={onConfirmPasswordChange}
              placeholder="Repeat new password"
              textContentType="newPassword"
              value={confirmPassword}
            />
          </Field>

          <Button disabled={disabled} loading={loading} onPress={onSubmit} size="lg">
            Update password
          </Button>
        </VStack>
      </Card>
    </AuthShell>
  );
}
