import { Button, Card, EmptyState, HStack, Separator, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import type { CartItem } from '../fixtures/commerce-fixtures';
import { cartItems, formatPrice } from '../fixtures/commerce-fixtures';
import { CartRow } from '../components/cart-row';
import { PatternScreen } from '../components/screen-shell';

export type CartScreenProps = {
  empty?: boolean;
  items?: CartItem[];
  onCheckout?: () => void;
  onQuantityChange?: (itemId: string, quantity: number) => void;
  onRemove?: (itemId: string) => void;
};

export function CartScreen({ empty = false, items = cartItems, onCheckout, onQuantityChange, onRemove }: CartScreenProps) {
  const visibleItems = empty ? [] : items;
  const subtotal = visibleItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const delivery = subtotal >= 100 ? 0 : 12;
  const discount = subtotal >= 300 ? 24 : 0;
  const total = subtotal + delivery - discount;

  return (
    <PatternScreen description="Review quantities, delivery, and the real total before moving to checkout." eyebrow="Bag" testID="cart-screen" title={`${visibleItems.length} ${visibleItems.length === 1 ? 'item' : 'items'} in your cart`}>
      {visibleItems.length === 0 ? (
        <EmptyState action={<Button variant="outline">Browse the collection</Button>} description="Saved pieces will stay here until you are ready." testID="cart-empty" title="Your cart is beautifully empty" />
      ) : (
        <VStack gap="lg" testID="cart-populated">
          <VStack gap="md">
            {visibleItems.map((item) => (
              <CartRow
                item={item}
                key={item.id}
                onQuantityChange={(itemId, quantity) => onQuantityChange?.(itemId, quantity)}
                onRemove={(itemId) => onRemove?.(itemId)}
              />
            ))}
          </VStack>
          <Card className="gap-3 p-4" variant="raised">
            <Text variant="heading">Order summary</Text>
            <HStack justify="between"><Text tone="muted">Subtotal</Text><Text>{formatPrice(subtotal)}</Text></HStack>
            <HStack justify="between"><Text tone="muted">Delivery</Text><Text>{delivery ? formatPrice(delivery) : 'Free'}</Text></HStack>
            {discount ? <HStack justify="between"><Text tone="success">Collection discount</Text><Text tone="success">−{formatPrice(discount)}</Text></HStack> : null}
            <Separator />
            <HStack justify="between"><Text variant="heading">Total</Text><Text variant="heading">{formatPrice(total)}</Text></HStack>
            <Button onPress={onCheckout} testID="cart-checkout">Continue to checkout</Button>
          </Card>
        </VStack>
      )}
    </PatternScreen>
  );
}
