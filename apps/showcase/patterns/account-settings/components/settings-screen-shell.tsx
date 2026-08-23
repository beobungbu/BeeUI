import { Box, Screen, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

export type SettingsScreenShellProps = {
  children: React.ReactNode;
  description?: string;
  eyebrow?: string;
  keyboardAware?: boolean;
  testID?: string;
  title: string;
};

export function SettingsScreenShell({
  children,
  description,
  eyebrow,
  keyboardAware = false,
  testID,
  title,
}: SettingsScreenShellProps) {
  const content = (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <Box className="mx-auto w-full max-w-[680px] flex-1 px-5 py-6 web:py-10">
        <VStack gap="xl">
          <VStack gap="sm">
            {eyebrow ? (
              <Text tone="muted" variant="caption">
                {eyebrow}
              </Text>
            ) : null}
            <Text className="text-3xl leading-10" variant="title">
              {title}
            </Text>
            {description ? (
              <Text tone="muted" variant="body">
                {description}
              </Text>
            ) : null}
          </VStack>
          {children}
        </VStack>
      </Box>
    </ScrollView>
  );

  return (
    <Screen testID={testID}>
      {keyboardAware ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </Screen>
  );
}
