import { HStack, Text } from '@beeui/ui';
import * as React from 'react';
import { formatPrice } from '../fixtures/commerce-fixtures';

export type PriceRowProps = {
  compact?: boolean;
  originalPrice?: number;
  price: number;
};

export function PriceRow({ compact = false, originalPrice, price }: PriceRowProps) {
  return (
    <HStack gap="sm" wrap>
      <Text className={compact ? 'text-base font-bold' : 'text-xl font-bold'}>{formatPrice(price)}</Text>
      {originalPrice ? <Text className="line-through" tone="subtle" variant={compact ? 'caption' : 'body'}>{formatPrice(originalPrice)}</Text> : null}
      {originalPrice && originalPrice > price ? (
        <Text tone="success" variant="caption">Save {Math.round(((originalPrice - price) / originalPrice) * 100)}%</Text>
      ) : null}
    </HStack>
  );
}
