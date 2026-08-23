import { Box, Screen, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { ScrollView } from 'react-native';

export type PatternScreenProps = {
  children: React.ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
  testID?: string;
};

export function PatternScreen({ children, description, eyebrow, title, testID }: PatternScreenProps) {
  return (
    <Screen className="flex-1 bg-surface" testID={testID}>
      <ScrollView contentContainerStyle={{ paddingBottom: 44 }} keyboardShouldPersistTaps="handled">
        <Box className="mx-auto w-full max-w-3xl px-4 pb-8 pt-6 web:px-6">
          <VStack gap="xl">
            <VStack gap="xs">
              {eyebrow ? <Text className="uppercase tracking-widest" tone="primary" variant="caption">{eyebrow}</Text> : null}
              <Text className="max-w-2xl" variant="title">{title}</Text>
              {description ? <Text className="max-w-2xl" tone="muted">{description}</Text> : null}
            </VStack>
            {children}
          </VStack>
        </Box>
      </ScrollView>
    </Screen>
  );
}
