import {
  Box,
  Button,
  HStack,
  SafeArea,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';
import { ComponentGallery } from './component-gallery';
import { PatternGallery } from './pattern-gallery';
import { getPublicShowcaseRoute, navigatePublicPath } from './public-route';
import { ShowcaseRoot } from './showcase-root';

function PublicSiteBar() {
  return (
    <SafeArea className="bg-surface" edges={['top', 'left', 'right']}>
      <HStack align="center" className="border-b border-border px-4 py-2" gap="sm" justify="between" wrap>
        <Text variant="caption">BeeUI public Showcase · real Web runtime</Text>
        <HStack gap="xs" wrap>
          <Button onPress={() => navigatePublicPath('/docs/')} size="sm" variant="ghost">Docs</Button>
          <Button onPress={() => navigatePublicPath('/demo/')} size="sm" variant="ghost">Demo</Button>
          <Button onPress={() => navigatePublicPath('/')} size="sm" variant="outline">BeeUI home</Button>
        </HStack>
      </HStack>
    </SafeArea>
  );
}

/**
 * Public chrome / legacy section wrapper only.
 *
 * Exact component/pattern/example/state identity is owned by ShowcaseRoot's single
 * canonical target resolver. This wrapper deliberately does not intercept legacy
 * `?component=` / `?pattern=` queries: ShowcaseRoot parses those as compatibility
 * inputs and normalizes all newly-emitted URLs to the #472 target contract.
 */
export function PublicShowcaseRouter() {
  const route = React.useMemo(() => getPublicShowcaseRoute(), []);
  let content: React.ReactNode;

  if (route.section === 'components') content = <ComponentGallery onBack={() => navigatePublicPath('/showcase/')} />;
  else if (route.section === 'patterns') content = <PatternGallery onBackToShowcase={() => navigatePublicPath('/showcase/')} />;
  else content = <ShowcaseRoot />;

  if (route.embed) return <>{content}</>;
  return (
    <Box className="flex-1">
      <PublicSiteBar />
      <Box className="flex-1">{content}</Box>
    </Box>
  );
}
