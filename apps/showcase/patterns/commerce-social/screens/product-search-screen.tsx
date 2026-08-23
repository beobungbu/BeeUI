import { Box, Button, Card, Chip, ChipGroup, EmptyState, HStack, SearchInput, Skeleton, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import type { Product } from '../fixtures/commerce-fixtures';
import { products } from '../fixtures/commerce-fixtures';
import { PatternScreen } from '../components/screen-shell';
import { ProductCard } from '../components/product-card';

export type ProductSearchMode = 'results' | 'empty' | 'loading';

export type ProductSearchScreenProps = {
  initialQuery?: string;
  mode?: ProductSearchMode;
  onFavorite?: (product: Product) => void;
  onFilterPress?: () => void;
  onProductSelect?: (product: Product) => void;
  onSortPress?: () => void;
};

export function ProductSearchScreen({
  initialQuery = 'linen',
  mode = 'results',
  onFavorite,
  onFilterPress,
  onProductSelect,
  onSortPress,
}: ProductSearchScreenProps) {
  const [query, setQuery] = React.useState(initialQuery);
  const [scope, setScope] = React.useState('All');
  const normalizedQuery = query.trim().toLowerCase();
  const resultProducts = products.filter((product) => {
    const matchesScope = scope === 'All' || product.category === scope;
    const searchable = `${product.name} ${product.subtitle} ${product.category}`.toLowerCase();
    return matchesScope && (!normalizedQuery || searchable.includes(normalizedQuery));
  });

  return (
    <PatternScreen description="Fast search with useful context before a filter surface becomes necessary." eyebrow="Discover" testID="product-search-screen" title="Find your next favorite thing">
      <VStack gap="md">
        <SearchInput accessibilityLabel="Product search query" onChangeText={setQuery} placeholder="Search the collection" value={query} />
        <HStack gap="sm" justify="between" wrap>
          <ChipGroup onValueChange={(value) => typeof value === 'string' && setScope(value)} value={scope}>
            {['All', 'Bags', 'Shoes', 'Home'].map((item) => <Chip key={item} value={item}>{item}</Chip>)}
          </ChipGroup>
          <HStack gap="xs">
            <Button onPress={onFilterPress} size="sm" testID="search-filter" variant="outline">Filters</Button>
            <Button onPress={onSortPress} size="sm" testID="search-sort" variant="ghost">Sort</Button>
          </HStack>
        </HStack>
      </VStack>

      {mode === 'loading' ? (
        <VStack gap="md" testID="product-search-loading">
          <Skeleton className="h-4 w-40" />
          {[0, 1, 2].map((item) => (
            <Card key={item} className="gap-3 p-3">
              <HStack align="start" gap="md">
                <Skeleton className="h-24 w-24 rounded-xl" />
                <VStack className="flex-1" gap="sm">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-4 w-1/3" />
                </VStack>
              </HStack>
            </Card>
          ))}
        </VStack>
      ) : mode === 'empty' || resultProducts.length === 0 ? (
        <EmptyState
          action={<Button onPress={() => setQuery('')} variant="outline">Clear search</Button>}
          description={`No products matched “${query}”. Try a broader phrase or clear a filter.`}
          testID="product-search-empty"
          title="Nothing found yet"
        />
      ) : (
        <VStack gap="md" testID="product-search-results">
          <HStack gap="sm" justify="between">
            <Text variant="heading">Results</Text>
            <Text tone="muted" variant="caption">{resultProducts.length} {resultProducts.length === 1 ? 'match' : 'matches'}</Text>
          </HStack>
          <Box className="flex-row flex-wrap justify-between gap-y-4">
            {resultProducts.map((product) => <ProductCard compact key={product.id} onFavorite={onFavorite} onSelect={onProductSelect} product={product} />)}
          </Box>
        </VStack>
      )}
    </PatternScreen>
  );
}
