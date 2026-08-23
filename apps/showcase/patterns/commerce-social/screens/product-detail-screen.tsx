import { Badge, Button, Card, Chip, ChipGroup, HStack, Separator, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import type { Product } from '../fixtures/commerce-fixtures';
import { products } from '../fixtures/commerce-fixtures';
import { PatternScreen } from '../components/screen-shell';
import { ProductImage } from '../components/product-image';
import { PriceRow } from '../components/price-row';
import { RatingSummary } from '../components/rating-summary';

export type ProductDetailScreenProps = {
  onAddToCart?: (product: Product, variant: string) => void;
  onFavorite?: (product: Product) => void;
  product?: Product;
};

type VariantSelection = {
  productId: string;
  variant?: string;
};

export function ProductDetailScreen({ onAddToCart, onFavorite, product = products[0]! }: ProductDetailScreenProps) {
  const [selection, setSelection] = React.useState<VariantSelection>(() => ({
    productId: product.id,
    variant: product.variants[0],
  }));
  const variant =
    selection.productId === product.id &&
    selection.variant !== undefined &&
    product.variants.includes(selection.variant)
      ? selection.variant
      : product.variants[0];

  React.useEffect(() => {
    setSelection((currentSelection) => {
      const currentVariant = currentSelection.productId === product.id ? currentSelection.variant : undefined;
      const nextVariant =
        currentVariant !== undefined && product.variants.includes(currentVariant)
          ? currentVariant
          : product.variants[0];

      if (currentSelection.productId === product.id && currentSelection.variant === nextVariant) {
        return currentSelection;
      }

      return { productId: product.id, variant: nextVariant };
    });
  }, [product.id, product.variants]);

  return (
    <PatternScreen description={product.subtitle} eyebrow={product.category} testID="product-detail-screen" title={product.name}>
      <VStack gap="lg">
        <ProductImage alt={product.name} aspectRatio={1.15} imageUri={product.imageUri} />
        <HStack gap="sm" justify="between" wrap>
          <RatingSummary rating={product.rating} reviewCount={product.reviewCount} />
          {product.badge ? <Badge variant="secondary">{product.badge}</Badge> : null}
        </HStack>
        <PriceRow originalPrice={product.originalPrice} price={product.price} />
        <Separator />
        <VStack gap="sm">
          <Text variant="label">Choose an option</Text>
          {product.variants.length > 0 ? (
            <ChipGroup
              onValueChange={(value) =>
                typeof value === 'string' && setSelection({ productId: product.id, variant: value })
              }
              value={variant}
            >
              {product.variants.map((item) => <Chip key={item} value={item}>{item}</Chip>)}
            </ChipGroup>
          ) : (
            <Text tone="muted" variant="caption">No options are currently available.</Text>
          )}
        </VStack>
        <VStack gap="xs">
          <Text variant="heading">Why it works</Text>
          <Text tone="muted">{product.description}</Text>
        </VStack>
        <Card className="gap-3 p-4" variant="muted">
          <VStack gap="xs">
            <Text variant="label">Availability</Text>
            <Text tone="muted" variant="caption">{product.availability}</Text>
          </VStack>
          <Separator />
          <VStack gap="xs">
            <Text variant="label">Delivery & returns</Text>
            <Text tone="muted" variant="caption">{product.shipping}</Text>
          </VStack>
        </Card>
        <HStack gap="sm" wrap>
          <Button className="flex-1" onPress={() => onFavorite?.(product)} testID="product-detail-favorite" variant="outline">♡ Save</Button>
          <Button
            className="flex-[2]"
            disabled={variant === undefined}
            onPress={() => variant !== undefined && onAddToCart?.(product, variant)}
            testID="product-detail-add"
          >
            {variant === undefined ? 'Unavailable' : `Add to cart · ${variant}`}
          </Button>
        </HStack>
      </VStack>
    </PatternScreen>
  );
}
