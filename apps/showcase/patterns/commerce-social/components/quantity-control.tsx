import { Button, HStack, Text } from '@beemvp/beeui-ui';
import * as React from 'react';

export type QuantityControlProps = {
  max?: number;
  min?: number;
  onValueChange: (value: number) => void;
  value: number;
};

export function QuantityControl({ max = 20, min = 1, onValueChange, value }: QuantityControlProps) {
  return (
    <HStack gap="sm">
      <Button
        accessibilityLabel="Decrease quantity"
        disabled={value <= min}
        onPress={() => onValueChange(Math.max(min, value - 1))}
        size="sm"
        testID="quantity-decrease"
        variant="outline"
      >
        −
      </Button>
      <Text className="min-w-7 text-center" variant="label">{value}</Text>
      <Button
        accessibilityLabel="Increase quantity"
        disabled={value >= max}
        onPress={() => onValueChange(Math.min(max, value + 1))}
        size="sm"
        testID="quantity-increase"
        variant="outline"
      >
        +
      </Button>
    </HStack>
  );
}
