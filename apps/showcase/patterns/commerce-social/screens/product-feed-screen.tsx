import { Badge, Box, Button, Card, Chip, ChipGroup, HStack, SearchInput, Skeleton, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import type { Product } from '../fixtures/commerce-fixtures';
import { products } from '../fixtures/commerce-fixtures';
import { PatternScreen } from '../components/screen-shell';
import { ProductCard } from '../components/product-card';
import { ProductImage } from '../components/product-image';
import { PriceRow } from '../components/price-row';
import { RatingSummary } from '../components/rating-summary';

export type ProductFeedScreenProps = {
  loading?: boolean;
  onFavorite?: (product: Product) => void;
  onProductSelect?: (product: Product) => void;
  onSearch?: (query: string) => void;
};

const categories = ['All', 'Bags', 'Shoes', 'Apparel', 'Tech', 'Home'];

export function ProductFeedScreen({ loading = false, onFavorite, onProductSelect, onSearch }: ProductFeedScreenProps) {
  const [category, setCategory] = React.useState('All');
  const featured = products[0]!;
  const filtered = category === 'All' ? products : products.filter((product) => product.category === category);

  return (
    <PatternScreen
      description="Curated everyday objects with confident materials, clear pricing, and no marketplace clutter."
      eyebrow="New season"
      testID="product-feed-screen"
      title="Made for the everyday, chosen with intention."
    >
      <VStack gap="md">
        <SearchInput accessibilityLabel="Search products" onSearch={onSearch} placeholder="Search products" />
        <ChipGroup onValueChange={(value) => typeof value === 'string' && setCategory(value)} value={category}>
          {categories.map((item) => <Chip key={item} value={item}>{item}</Chip>)}
        </ChipGroup>
      </VStack>

      {loading ? (
        <VStack gap="lg" testID="product-feed-loading">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Box className="flex-row flex-wrap justify-between gap-y-4">
            {[0, 1, 2, 3].map((item) => (
              <Card key={item} className="w-[48%] gap-3 p-3">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
              </Card>
            ))}
          </Box>
        </VStack>
      ) : (
        <VStack gap="xl">
          <Card className="gap-4 overflow-hidden p-4" variant="raised">
            <ProductImage alt={featured.name} aspectRatio={1.65} imageUri={featured.imageUri} />
            <VStack gap="sm">
              <HStack gap="sm" justify="between" wrap>
                <Badge variant="secondary">Featured</Badge>
                <RatingSummary rating={featured.rating} reviewCount={featured.reviewCount} />
              </HStack>
              <Text variant="heading">{featured.name}</Text>
              <Text tone="muted">{featured.subtitle}</Text>
              <PriceRow originalPrice={featured.originalPrice} price={featured.price} />
              <Button onPress={() => onProductSelect?.(featured)} testID="featured-product-open">Explore the edit</Button>
            </VStack>
          </Card>

          <VStack gap="md">
            <HStack gap="sm" justify="between">
              <VStack className="min-w-0 flex-1" gap="none">
                <Text variant="heading">Shop the collection</Text>
                <Text tone="muted" variant="caption">{filtered.length} considered pieces</Text>
              </VStack>
              <Text tone="subtle" variant="caption">Fresh weekly</Text>
            </HStack>
            <Box className="flex-row flex-wrap justify-between gap-y-4">
              {filtered.map((product) => (
                <ProductCard compact key={product.id} onFavorite={onFavorite} onSelect={onProductSelect} product={product} />
              ))}
            </Box>
          </VStack>
        </VStack>
      )}
    </PatternScreen>
  );
}
