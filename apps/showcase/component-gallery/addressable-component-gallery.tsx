import { Badge, Box, Card, Text, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import { ComponentGallery } from './component-gallery';
import { findShowcaseExample } from '../example-registry';
import type { ShowcaseTarget } from '../showcase-target';

export function AddressableComponentGallery({
  onBack,
  target,
}: {
  onBack: () => void;
  target: ShowcaseTarget;
}) {
  const example = findShowcaseExample(target);

  return (
    <Box className="flex-1" testID="addressable-component-gallery">
      <ComponentGallery onBack={onBack} />
      {example ? (
        <Box
          className="pointer-events-none absolute left-3 right-3 top-3 z-50 items-center"
          testID="showcase-active-example"
        >
          <Card className="w-full max-w-xl border border-primary bg-surface" padding="sm" variant="raised">
            <VStack gap="xs">
              <Box className="flex-row items-center gap-2">
                <Badge variant="secondary">Exact target</Badge>
                <Text variant="label">{`${example.ownerId} / ${example.id}`}</Text>
              </Box>
              <Text tone="muted" variant="caption">{example.intent}</Text>
              <Text testID="showcase-active-example-source" tone="subtle" variant="caption">
                {example.sourcePath}
              </Text>
            </VStack>
          </Card>
        </Box>
      ) : null}
    </Box>
  );
}
