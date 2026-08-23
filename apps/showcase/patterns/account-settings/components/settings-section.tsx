import { Text, VStack } from '@beeui/ui';
import * as React from 'react';

export type SettingsSectionProps = {
  children: React.ReactNode;
  description?: string;
  title: string;
};

export function SettingsSection({ children, description, title }: SettingsSectionProps) {
  return (
    <VStack gap="sm">
      <VStack gap="xs" className="px-1">
        <Text variant="heading">{title}</Text>
        {description ? (
          <Text tone="muted" variant="caption">
            {description}
          </Text>
        ) : null}
      </VStack>
      {children}
    </VStack>
  );
}
