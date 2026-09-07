import { Box, Button, HStack, Text } from '@beemvp/beeui-ui';
import * as React from 'react';

function go(path: string) {
  const location = (globalThis as unknown as { location?: { assign?: (next: string) => void } }).location;
  location?.assign?.(path);
}

export function PublicSiteBar() {
  return (
    <Box className="border-b border-border bg-surface px-4 py-2" testID="demo-public-site-bar">
      <HStack align="center" gap="sm" justify="between" wrap>
        <Text variant="caption">BeeUI production reference app · mock services · app-owned routing</Text>
        <HStack gap="xs" wrap>
          <Button onPress={() => go('/docs/reference-app/')} size="sm" variant="ghost">Guide</Button>
          <Button onPress={() => go('/showcase/')} size="sm" variant="ghost">Showcase</Button>
          <Button onPress={() => go('/')} size="sm" variant="outline">BeeUI home</Button>
        </HStack>
      </HStack>
    </Box>
  );
}
