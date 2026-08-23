import { Button, Card, Field, Input, Link, VStack } from '@beeui/ui';
import * as React from 'react';
import { AuthHeader, AuthShell, ServerError } from '../components/auth-shared';

export type ForgotPasswordScreenProps = {
  disabled?: boolean;
  email: string;
  emailError?: string;
  error?: string;
  loading?: boolean;
  onBackToSignIn: () => void;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
};

export function ForgotPasswordScreen({
  disabled = false,
  email,
  emailError,
  error,
  loading = false,
  onBackToSignIn,
  onEmailChange,
  onSubmit,
}: ForgotPasswordScreenProps) {
  const blocked = disabled || loading;

  return (
    <AuthShell testID="forgot-password-screen">
      <AuthHeader
        description="Enter the email associated with your account and we’ll send a verification code."
        title="Reset your password"
      />

      <ServerError error={error} title="Unable to send code" />

      <Card padding="lg" variant="raised">
        <VStack gap="lg">
          <Field error={emailError} invalid={Boolean(emailError)} label="Email" required>
            <Input
              autoCapitalize="none"
              autoComplete="email"
              disabled={blocked}
              keyboardType="email-address"
              onChangeText={onEmailChange}
              placeholder="you@example.com"
              value={email}
            />
          </Field>

          <Button disabled={disabled} loading={loading} onPress={onSubmit} size="lg">
            Send verification code
          </Button>
        </VStack>
      </Card>

      <Link disabled={blocked} onPress={onBackToSignIn}>
        Back to sign in
      </Link>
    </AuthShell>
  );
}
