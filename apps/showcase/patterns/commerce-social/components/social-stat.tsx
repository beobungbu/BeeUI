import { Text, VStack } from '@beeui/ui';
import * as React from 'react';

export type SocialStatProps = {
  label: string;
  value: string | number;
};

export function SocialStat({ label, value }: SocialStatProps) {
  return (
    <VStack align="center" gap="none">
      <Text className="font-bold" variant="heading">{value}</Text>
      <Text tone="muted" variant="caption">{label}</Text>
    </VStack>
  );
}
