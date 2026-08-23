import { Button, Card, HStack, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import type { CartItem } from '../fixtures/commerce-fixtures';
import { formatPrice } from '../fixtures/commerce-fixtures';
import { ProductImage } from './product-image';
import { QuantityControl } from './quantity-control';

export type CartRowProps = {
  item: CartItem;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
};

export function CartRow({ item, onQuantityChange, onRemove }: CartRowProps) {
  return (
    <Card className="gap-4 p-4">
      <HStack align="start" gap="md">
        <ProductImage alt={item.product.name} className="shrink-0" imageUri={item.product.imageUri} style={{ width: 88 }} />
        <VStack className="min-w-0 flex-1" gap="xs">
          <Text numberOfLines={2} variant="label">{item.product.name}</Text>
          <Text tone="muted" variant="caption">{item.variant}</Text>
          <Text className="font-bold">{formatPrice(item.product.price * item.quantity)}</Text>
        </VStack>
      </HStack>
      <HStack gap="sm" justify="between" wrap>
        <QuantityControl onValueChange={(quantity) => onQuantityChange(item.id, quantity)} value={item.quantity} />
        <Button onPress={() => onRemove(item.id)} size="sm" testID={`remove-${item.id}`} variant="ghost">Remove</Button>
      </HStack>
    </Card>
  );
}
