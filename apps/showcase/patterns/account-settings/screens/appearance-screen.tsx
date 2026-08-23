import { Box, HStack, SegmentedControl, SegmentedControlItem, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { SettingsScreenShell } from '../components/settings-screen-shell';
import { SettingsSection } from '../components/settings-section';

export type AppearanceTheme = 'system' | 'light' | 'dark';

export type AppearanceScreenProps = {
  onThemeChange: (value: AppearanceTheme) => void;
  theme: AppearanceTheme;
};

export function AppearanceScreen({ onThemeChange, theme }: AppearanceScreenProps) {
  return (
    <SettingsScreenShell
      description="The selected theme remains owned by the caller; this pattern only presents the preference."
      eyebrow="Preferences"
      testID="appearance-screen"
      title="Appearance"
    >
      <SettingsSection
        description="System follows the device appearance automatically."
        title="Theme"
      >
        <SegmentedControl
          accessibilityLabel="Theme"
          onValueChange={(value) => onThemeChange(value as AppearanceTheme)}
          value={theme}
        >
          <SegmentedControlItem value="system">System</SegmentedControlItem>
          <SegmentedControlItem value="light">Light</SegmentedControlItem>
          <SegmentedControlItem value="dark">Dark</SegmentedControlItem>
        </SegmentedControl>
      </SettingsSection>

      <SettingsSection title="Preview">
        <Box className="overflow-hidden rounded-2xl border border-border bg-surface p-4">
          <VStack gap="md">
            <HStack justify="between">
              <VStack gap="xs">
                <Text variant="heading">BeeUI</Text>
                <Text tone="muted" variant="caption">
                  Calm semantic surfaces
                </Text>
              </VStack>
              <Box className="h-8 w-8 rounded-full bg-primary" />
            </HStack>
            <Box className="rounded-xl border border-border bg-surface-muted p-3">
              <Text variant="label">Selected: {theme}</Text>
              <Text tone="muted" variant="caption">
                Preview uses semantic BeeUI tokens, so dark mode does not need duplicated screen styles.
              </Text>
            </Box>
          </VStack>
        </Box>
      </SettingsSection>
    </SettingsScreenShell>
  );
}
