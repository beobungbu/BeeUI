import {
  AppHeader,
  Badge,
  Box,
  Button,
  HStack,
  SafeArea,
  Screen,
  Text,
  VStack,
} from '@beemvp/beeui-ui';
import * as React from 'react';
import { ComponentGallery } from './component-gallery';
import { PatternGallery } from './pattern-gallery';
import {
  defaultPatternState,
  findPatternDomain,
  findPatternScreen,
} from './pattern-gallery/pattern-catalog';
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

function ComponentDeepLink({ component }: { component: string }) {
  return (
    <Box className="flex-1" testID={`public-component-${component}`}>
      <Box className="border-b border-border bg-surface px-4 py-3">
        <HStack align="center" gap="sm" wrap>
          <Badge variant="info">Requested family</Badge>
          <Text variant="heading">{component}</Text>
          <Button
            onPress={() => navigatePublicPath(`/docs/components/reference/${component}/`)}
            size="sm"
            variant="outline"
          >
            Reference
          </Button>
        </HStack>
        <Text tone="muted" variant="caption">
          This deep link opens the canonical Component Gallery. The reference page carries the exact typechecked fixture source for this family.
        </Text>
      </Box>
      <Box className="flex-1">
        <ComponentGallery onBack={() => navigatePublicPath('/showcase/')} />
      </Box>
    </Box>
  );
}

function PatternDeepLink({ pattern }: { pattern: string }) {
  const [domainId, screenId] = pattern.split('/');
  const domain = findPatternDomain(domainId);
  const screen = findPatternScreen(domain, screenId);

  if (!domain || !screen) {
    return (
      <Screen>
        <SafeArea className="flex-1 bg-background" edges={['top', 'left', 'right', 'bottom']}>
          <Box className="mx-auto w-full max-w-2xl gap-4 px-5 py-8">
            <Text variant="title">Pattern not found</Text>
            <Text tone="muted">The requested Pattern Gallery identity no longer resolves.</Text>
            <Button onPress={() => navigatePublicPath('/showcase/?section=patterns')}>Browse patterns</Button>
          </Box>
        </SafeArea>
      </Screen>
    );
  }

  const Demo = screen.component;
  const stateId = defaultPatternState(screen);
  return (
    <Screen testID={`public-pattern-${domain.id}-${screen.id}`}>
      <SafeArea className="bg-surface" edges={['top', 'left', 'right']}>
        <AppHeader
          description={`${domain.title} · exact Pattern Gallery demo component · default state ${stateId}`}
          leading={<Button onPress={() => navigatePublicPath('/showcase/?section=patterns')} size="sm" variant="ghost">Patterns</Button>}
          title={screen.title}
          trailing={<Button onPress={() => navigatePublicPath(`/docs/patterns/reference/${domain.id}/${screen.id}-screen/`)} size="sm" variant="outline">Guide</Button>}
        />
      </SafeArea>
      <SafeArea className="flex-1 bg-background" edges={['left', 'right', 'bottom']}>
        <Demo stateId={stateId} />
      </SafeArea>
    </Screen>
  );
}

export function PublicShowcaseRouter() {
  const route = React.useMemo(() => getPublicShowcaseRoute(), []);
  let content: React.ReactNode;

  if (route.component) content = <ComponentDeepLink component={route.component} />;
  else if (route.pattern) content = <PatternDeepLink pattern={route.pattern} />;
  else if (route.section === 'components') content = <ComponentGallery onBack={() => navigatePublicPath('/showcase/')} />;
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
