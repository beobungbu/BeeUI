import { Button, HStack, Text, VStack } from '@beeui/ui';
import * as React from 'react';

export type SectionHeaderProps = {
  actionLabel?: string;
  description?: string;
  onAction?: () => void;
  title: string;
};

export function SectionHeader({ actionLabel, description, onAction, title }: SectionHeaderProps) {
  return (
    <HStack align="start" justify="between">
      <VStack className="min-w-0 flex-1" gap="xs">
        <Text variant="heading">{title}</Text>
        {description ? <Text tone="muted" variant="caption">{description}</Text> : null}
      </VStack>
      {actionLabel && onAction ? (
        <Button onPress={onAction} size="sm" variant="ghost">
          {actionLabel}
        </Button>
      ) : null}
    </HStack>
  );
}
