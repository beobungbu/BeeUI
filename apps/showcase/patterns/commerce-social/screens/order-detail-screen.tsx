import { Badge, Button, Card, HStack, Separator, Text, Timeline, TimelineItem, VStack } from '@beeui/ui';
import * as React from 'react';
import type { Order } from '../fixtures/commerce-fixtures';
import { formatPrice, orders } from '../fixtures/commerce-fixtures';
import { PatternScreen } from '../components/screen-shell';
import { ProductImage } from '../components/product-image';

export type OrderDetailScreenProps = {
  onReorder?: (order: Order) => void;
  onSupport?: (order: Order) => void;
  order?: Order;
};

export function OrderDetailScreen({ onReorder, onSupport, order = orders[0]! }: OrderDetailScreenProps) {
  return (
    <PatternScreen description={`${order.date} · ${order.itemCount} ${order.itemCount === 1 ? 'item' : 'items'}`} eyebrow={`Order ${order.number}`} testID="order-detail-screen" title="On its way to you">
      <VStack gap="lg">
        <Card className="gap-4 p-4" variant="raised">
          <HStack gap="sm" justify="between" wrap>
            <Text variant="heading">Delivery status</Text>
            <Badge variant={order.status === 'Delivered' ? 'success' : order.status === 'Shipped' ? 'info' : 'warning'}>{order.status}</Badge>
          </HStack>
          <Timeline>
            {order.history.map((event) => (
              <TimelineItem description={event.description} key={`${order.id}-${event.title}`} meta={event.meta} status={event.status} title={event.title} />
            ))}
          </Timeline>
        </Card>

        <VStack gap="md">
          <Text variant="heading">Items</Text>
          {order.items.map((item) => (
            <Card className="p-4" key={item.id}>
              <HStack align="start" gap="md">
                <ProductImage alt={item.product.name} className="shrink-0" imageUri={item.product.imageUri} style={{ width: 72 }} />
                <VStack className="min-w-0 flex-1" gap="xs">
                  <Text numberOfLines={2} variant="label">{item.product.name}</Text>
                  <Text tone="muted" variant="caption">{item.variant} · Qty {item.quantity}</Text>
                  <Text>{formatPrice(item.product.price * item.quantity)}</Text>
                </VStack>
              </HStack>
            </Card>
          ))}
        </VStack>

        <Card className="gap-3 p-4">
          <Text variant="heading">Shipping & payment</Text>
          <VStack gap="xs"><Text variant="label">Deliver to</Text><Text tone="muted" variant="caption">{order.shippingAddress}</Text></VStack>
          <Separator />
          <VStack gap="xs"><Text variant="label">Paid with</Text><Text tone="muted" variant="caption">{order.paymentMethod}</Text></VStack>
          <Separator />
          <HStack justify="between"><Text variant="heading">Total</Text><Text variant="heading">{formatPrice(order.total)}</Text></HStack>
        </Card>

        <HStack gap="sm" wrap>
          <Button className="flex-1" onPress={() => onSupport?.(order)} testID="order-support" variant="outline">Get support</Button>
          <Button className="flex-1" onPress={() => onReorder?.(order)} testID="order-reorder">Reorder</Button>
        </HStack>
      </VStack>
    </PatternScreen>
  );
}
