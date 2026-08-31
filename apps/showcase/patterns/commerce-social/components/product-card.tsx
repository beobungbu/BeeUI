import { Badge, Button, Card, Text, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import { Pressable } from 'react-native';
import type { Product } from '../fixtures/commerce-fixtures';
import { PriceRow } from './price-row';
import { ProductImage } from './product-image';
import { RatingSummary } from './rating-summary';

export type ProductCardProps = {
  compact?: boolean;
  onFavorite?: (product: Product) => void;
  onSelect?: (product: Product) => void;
  product: Product;
};

export function ProductCard({ compact = false, onFavorite, onSelect, product }: ProductCardProps) {
  return (
    <Pressable
      accessibilityLabel={`Open ${product.name}`}
      accessibilityRole="button"
      onPress={() => onSelect?.(product)}
      style={{ width: compact ? '48%' : '100%' }}
      testID={`product-card-${product.id}`}
    >
      <Card className="h-full gap-3 p-3" variant="raised">
        <ProductImage alt={product.name} imageUri={product.imageUri} />
        <VStack className="min-w-0" gap="xs">
          {product.badge ? <Badge variant="secondary">{product.badge}</Badge> : null}
          <Text numberOfLines={2} variant="label">{product.name}</Text>
          <Text numberOfLines={1} tone="muted" variant="caption">{product.subtitle}</Text>
          <RatingSummary rating={product.rating} reviewCount={product.reviewCount} />
          <PriceRow compact originalPrice={product.originalPrice} price={product.price} />
        </VStack>
        <Button
          accessibilityLabel={`Favorite ${product.name}`}
          onPress={(event) => {
            event?.stopPropagation?.();
            onFavorite?.(product);
          }}
          size="sm"
          testID={`favorite-${product.id}`}
          variant="ghost"
        >
          ♡ Save
        </Button>
      </Card>
    </Pressable>
  );
}
