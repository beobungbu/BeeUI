import { Box, Button, Card, Text, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import { AuthShell } from '../components/auth-shared';

export type PasswordUpdatedScreenProps = {
  onContinue: () => void;
};

export function PasswordUpdatedScreen({ onContinue }: PasswordUpdatedScreenProps) {
  return (
    <AuthShell testID="password-updated-screen">
      <VStack className="flex-1" justify="center" gap="xl">
        <Box className="items-center">
          <Box
            accessibilityLabel="Password updated successfully"
            className="h-20 w-20 items-center justify-center rounded-full border border-success bg-surface"
          >
            <Text className="text-3xl" tone="success" variant="title">
              ✓
            </Text>
          </Box>
        </Box>

        <Card padding="lg" variant="raised">
          <VStack align="center" gap="md">
            <Text className="text-center" variant="title">
              Password updated
            </Text>
            <Text className="text-center" tone="muted" variant="body">
              Your new password is ready. You can now use it the next time you sign in.
            </Text>
            <Button className="mt-2 w-full" onPress={onContinue} size="lg">
              Continue to sign in
            </Button>
          </VStack>
        </Card>
      </VStack>
    </AuthShell>
  );
}
