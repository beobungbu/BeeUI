import { Button, Card, Field, Input, Link, PasswordInput, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import {
  AuthHeader,
  AuthShell,
  ServerError,
  SocialAuthActions,
} from '../components/auth-shared';

export type SignInScreenProps = {
  disabled?: boolean;
  email: string;
  emailError?: string;
  error?: string;
  loading?: boolean;
  onAppleSignIn?: () => void;
  onCreateAccount: () => void;
  onEmailChange: (value: string) => void;
  onForgotPassword: () => void;
  onGoogleSignIn?: () => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  password: string;
  passwordError?: string;
};

export function SignInScreen({
  disabled = false,
  email,
  emailError,
  error,
  loading = false,
  onAppleSignIn,
  onCreateAccount,
  onEmailChange,
  onForgotPassword,
  onGoogleSignIn,
  onPasswordChange,
  onSubmit,
  password,
  passwordError,
}: SignInScreenProps) {
  const blocked = disabled || loading;

  return (
    <AuthShell testID="sign-in-screen">
      <AuthHeader
        description="Use your email and password to continue where you left off."
        title="Welcome back"
      />

      <ServerError error={error} title="Unable to sign in" />

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

          <VStack gap="sm">
            <Field error={passwordError} invalid={Boolean(passwordError)} label="Password" required>
              <PasswordInput
                disabled={blocked}
                onChangeText={onPasswordChange}
                placeholder="Enter your password"
                value={password}
              />
            </Field>
            <Link disabled={blocked} onPress={onForgotPassword}>
              Forgot password?
            </Link>
          </VStack>

          <Button disabled={disabled} loading={loading} onPress={onSubmit} size="lg">
            Sign in
          </Button>

          <SocialAuthActions
            disabled={blocked}
            onAppleSignIn={onAppleSignIn}
            onGoogleSignIn={onGoogleSignIn}
          />
        </VStack>
      </Card>

      <VStack align="center" gap="xs">
        <Text tone="muted" variant="caption">
          New to BeeUI?
        </Text>
        <Link className="self-center" disabled={blocked} onPress={onCreateAccount}>
          Create an account
        </Link>
      </VStack>
    </AuthShell>
  );
}
