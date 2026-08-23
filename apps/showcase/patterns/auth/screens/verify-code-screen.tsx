import { Button, Card, Field, HStack, Link, OTPInput, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { AuthHeader, AuthShell, ServerError } from '../components/auth-shared';

export type VerifyCodeScreenProps = {
  canResend?: boolean;
  code: string;
  countdownText?: string;
  destination: string;
  disabled?: boolean;
  error?: string;
  loading?: boolean;
  onChangeDestination: () => void;
  onCodeChange: (value: string) => void;
  onComplete?: (value: string) => void;
  onResend: () => void;
  onSubmit: () => void;
  resendLabel?: string;
};

export function VerifyCodeScreen({
  canResend = false,
  code,
  countdownText,
  destination,
  disabled = false,
  error,
  loading = false,
  onChangeDestination,
  onCodeChange,
  onComplete,
  onResend,
  onSubmit,
  resendLabel = 'Resend code',
}: VerifyCodeScreenProps) {
  const blocked = disabled || loading;
  const incomplete = code.length < 6;

  return (
    <AuthShell testID="verify-code-screen">
      <AuthHeader
        description={`We sent a 6-digit code to ${destination}. Enter it below to continue.`}
        title="Check your inbox"
      />

      <ServerError error={error} title="That code did not work" />

      <Card padding="lg" variant="raised">
        <VStack gap="lg">
          <Field
            description="Codes expire for your security."
            invalid={Boolean(error)}
            label="Verification code"
            required
          >
            <OTPInput
              disabled={blocked}
              invalid={Boolean(error)}
              length={6}
              onComplete={onComplete}
              onValueChange={onCodeChange}
              value={code}
            />
          </Field>

          <Button
            disabled={disabled || incomplete}
            loading={loading}
            onPress={onSubmit}
            size="lg"
          >
            Verify code
          </Button>

          <HStack justify="between" wrap>
            <Link disabled={blocked || !canResend} onPress={onResend}>
              {resendLabel}
            </Link>
            {countdownText ? (
              <Text tone="muted" variant="caption">
                {countdownText}
              </Text>
            ) : null}
          </HStack>
        </VStack>
      </Card>

      <Link disabled={blocked} onPress={onChangeDestination}>
        Use a different email
      </Link>
    </AuthShell>
  );
}
