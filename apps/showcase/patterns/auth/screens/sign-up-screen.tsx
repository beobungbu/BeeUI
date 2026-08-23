import {
  AlertBanner,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Link,
  PasswordInput,
  Text,
  VStack,
} from '@beeui/ui';
import * as React from 'react';
import {
  AuthHeader,
  AuthShell,
  PasswordRequirements,
  ServerError,
  SocialAuthActions,
  type PasswordRequirement,
} from '../components/auth-shared';
import { getPasswordRequirements } from '../fixtures/auth-fixtures';

export type SignUpFieldErrors = {
  confirmPassword?: string;
  email?: string;
  name?: string;
  password?: string;
  terms?: string;
};

export type SignUpScreenProps = {
  acceptedTerms: boolean;
  confirmPassword: string;
  disabled?: boolean;
  email: string;
  error?: string;
  fieldErrors?: SignUpFieldErrors;
  loading?: boolean;
  name: string;
  onAcceptedTermsChange: (checked: boolean) => void;
  onAppleSignIn?: () => void;
  onConfirmPasswordChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onGoogleSignIn?: () => void;
  onNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSignIn: () => void;
  onSubmit: () => void;
  password: string;
  passwordRequirements?: PasswordRequirement[];
};

export function SignUpScreen({
  acceptedTerms,
  confirmPassword,
  disabled = false,
  email,
  error,
  fieldErrors = {},
  loading = false,
  name,
  onAcceptedTermsChange,
  onAppleSignIn,
  onConfirmPasswordChange,
  onEmailChange,
  onGoogleSignIn,
  onNameChange,
  onPasswordChange,
  onSignIn,
  onSubmit,
  password,
  passwordRequirements,
}: SignUpScreenProps) {
  const blocked = disabled || loading;
  const requirements = passwordRequirements ?? getPasswordRequirements(password);

  return (
    <AuthShell compact testID="sign-up-screen">
      <AuthHeader
        description="Create your profile now. You can personalize the rest during onboarding."
        title="Create account"
      />

      <ServerError error={error} title="Unable to create account" />

      <Card padding="lg" variant="raised">
        <VStack gap="lg">
          <Field error={fieldErrors.name} invalid={Boolean(fieldErrors.name)} label="Name" required>
            <Input
              autoComplete="name"
              disabled={blocked}
              onChangeText={onNameChange}
              placeholder="Your name"
              value={name}
            />
          </Field>

          <Field error={fieldErrors.email} invalid={Boolean(fieldErrors.email)} label="Email" required>
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

          <Field
            error={fieldErrors.password}
            invalid={Boolean(fieldErrors.password)}
            label="Password"
            required
          >
            <PasswordInput
              autoComplete="new-password"
              disabled={blocked}
              onChangeText={onPasswordChange}
              placeholder="Create a password"
              textContentType="newPassword"
              value={password}
            />
          </Field>

          <PasswordRequirements requirements={requirements} />

          <Field
            error={fieldErrors.confirmPassword}
            invalid={Boolean(fieldErrors.confirmPassword)}
            label="Confirm password"
            required
          >
            <PasswordInput
              autoComplete="new-password"
              disabled={blocked}
              onChangeText={onConfirmPasswordChange}
              placeholder="Repeat your password"
              textContentType="newPassword"
              value={confirmPassword}
            />
          </Field>

          <VStack gap="sm">
            <Checkbox
              checked={acceptedTerms}
              disabled={blocked}
              label="I agree to the Terms of Service and Privacy Policy"
              onCheckedChange={onAcceptedTermsChange}
            />
            {fieldErrors.terms ? (
              <AlertBanner
                description={fieldErrors.terms}
                title="Terms acceptance required"
                variant="destructive"
              />
            ) : null}
          </VStack>

          <Button disabled={disabled || !acceptedTerms} loading={loading} onPress={onSubmit} size="lg">
            Create account
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
          Already have an account?
        </Text>
        <Link disabled={blocked} onPress={onSignIn}>
          Sign in
        </Link>
      </VStack>
    </AuthShell>
  );
}
