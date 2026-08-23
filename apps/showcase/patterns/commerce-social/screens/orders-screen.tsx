import { Badge, Button, Card, EmptyState, HStack, SegmentedControl, SegmentedControlItem, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import type { Order } from '../fixtures/commerce-fixtures';
import { formatPrice, orders } from '../fixtures/commerce-fixtures';
import { PatternScreen } from '../components/screen-shell';

export type OrdersScreenProps = {
  empty?: boolean;
  onOrderSelect?: (order: Order) => void;
};

const statusVariant = (status: Order['status']) => status === 'Delivered' ? 'success' as const : status === 'Shipped' ? 'info' as const : 'warning' as const;

export function OrdersScreen({ empty = false, onOrderSelect }: OrdersScreenProps) {
  const [tab, setTab] = React.useState('active');
  const visible = empty ? [] : tab === 'active' ? orders.filter((order) => order.status !== 'Delivered') : orders.filter((order) => order.status === 'Delivered');

  return (
    <PatternScreen description="Track what is moving now and keep completed purchases easy to revisit." eyebrow="Account" testID="orders-screen" title="Your orders">
      <SegmentedControl onValueChange={setTab} value={tab}>
        <SegmentedControlItem value="active">Active</SegmentedControlItem>
        <SegmentedControlItem value="past">Past</SegmentedControlItem>
      </SegmentedControl>
      {visible.length === 0 ? (
        <EmptyState action={<Button variant="outline">Start shopping</Button>} description="When you place an order, its progress will appear here." testID="orders-empty" title="No orders in this view" />
      ) : (
        <VStack gap="md" testID="orders-active">
          {visible.map((order) => (
            <Card className="gap-4 p-4" key={order.id} variant="raised">
              <HStack gap="sm" justify="between">
                <VStack gap="none">
                  <Text variant="label">Order {order.number}</Text>
                  <Text tone="muted" variant="caption">{order.date}</Text>
                </VStack>
                <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
              </HStack>
              <HStack gap="sm" justify="between" wrap>
                <Text tone="muted">{order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}</Text>
                <Text className="font-bold">{formatPrice(order.total)}</Text>
              </HStack>
              <Button onPress={() => onOrderSelect?.(order)} testID={`order-${order.id}`} variant="outline">View order</Button>
            </Card>
          ))}
        </VStack>
      )}
    </PatternScreen>
  );
}
