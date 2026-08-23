import { Box, Button, Card, HStack, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { AuthShell } from '../components/auth-shared';

export type WelcomeScreenProps = {
  onGetStarted: () => void;
  onSignIn: () => void;
};

export function WelcomeScreen({ onGetStarted, onSignIn }: WelcomeScreenProps) {
  return (
    <AuthShell
      footer={
        <Text className="text-center" tone="subtle" variant="caption">
          By continuing, you agree to the Terms of Service and Privacy Policy.
        </Text>
      }
      testID="welcome-screen"
    >
      <VStack className="flex-1" justify="between" gap="xl">
        <VStack gap="xl">
          <HStack gap="sm">
            <Box className="h-11 w-11 items-center justify-center rounded-xl bg-primary">
              <Text className="text-primary-foreground" variant="heading">
                B
              </Text>
            </Box>
            <VStack gap="none" justify="center">
              <Text variant="heading">BeeUI</Text>
              <Text tone="muted" variant="caption">
                Thoughtful mobile patterns
              </Text>
            </VStack>
          </HStack>

          <VStack className="pt-8" gap="md">
            <Text className="text-4xl leading-[48px]" variant="title">
              Make your next screen feel finished.
            </Text>
            <Text tone="muted" variant="body">
              A calm starting point for a modern account experience, built entirely from BeeUI public primitives.
            </Text>
          </VStack>
        </VStack>

        <Card className="mt-8" padding="lg" variant="raised">
          <VStack gap="md">
            <Button onPress={onGetStarted} size="lg">
              Get started
            </Button>
            <Button onPress={onSignIn} size="lg" variant="outline">
              I already have an account
            </Button>
          </VStack>
        </Card>
      </VStack>
    </AuthShell>
  );
}
