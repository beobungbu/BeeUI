import { HStack, Text } from '@beeui/ui';
import * as React from 'react';

export type RatingSummaryProps = {
  rating: number;
  reviewCount: number;
};

export function RatingSummary({ rating, reviewCount }: RatingSummaryProps) {
  return (
    <HStack gap="xs">
      <Text tone="warning" variant="caption">★</Text>
      <Text variant="caption">{rating.toFixed(1)}</Text>
      <Text tone="muted" variant="caption">({reviewCount})</Text>
    </HStack>
  );
}
