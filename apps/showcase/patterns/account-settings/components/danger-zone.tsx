import { Box, Button, Text, VStack } from '@beeui/ui';
import * as React from 'react';

export type DangerZoneProps = {
  description: string;
  onPress: () => void;
  title: string;
};

export function DangerZone({ description, onPress, title }: DangerZoneProps) {
  return (
    <Box className="rounded-2xl border border-destructive/40 bg-surface p-4">
      <VStack gap="md">
        <VStack gap="xs">
          <Text tone="destructive" variant="heading">
            {title}
          </Text>
          <Text tone="muted" variant="caption">
            {description}
          </Text>
        </VStack>
        <Button onPress={onPress} variant="destructive">
          {title}
        </Button>
      </VStack>
    </Box>
  );
}
