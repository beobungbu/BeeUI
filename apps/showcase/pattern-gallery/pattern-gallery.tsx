import {
  AppHeader,
  Badge,
  Box,
  Button,
  Card,
  HStack,
  SafeArea,
  Screen,
  Text,
  VStack,
} from '@beeui/ui';
import * as React from 'react';
import { ScrollView, StatusBar, useWindowDimensions } from 'react-native';
import { Uniwind, useUniwind } from 'uniwind';
import {
  defaultPatternState,
  findPatternDomain,
  findPatternScreen,
  patternCatalog,
} from './pattern-catalog';
import type { PatternDomain, PatternScreenDefinition } from './types';

export function GalleryThemeControl() {
  const { hasAdaptiveThemes, theme } = useUniwind();
  const activeTheme = hasAdaptiveThemes ? 'system' : theme;
  const nextTheme = activeTheme === 'system' ? 'light' : activeTheme === 'light' ? 'dark' : 'system';

  return (
    <Button
      accessibilityLabel={`Theme ${activeTheme}. Switch to ${nextTheme}`}
      onPress={() => Uniwind.setTheme(nextTheme)}
      size="sm"
      variant="outline"
    >
      {`Theme: ${activeTheme}`}
    </Button>
  );
}

function GalleryHome({ onOpenDomain }: { onOpenDomain: (domainId: string) => void }) {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 80 }} style={{ flex: 1 }}>
      <Box className="mx-auto w-full max-w-5xl gap-6 px-4 py-6">
        <VStack gap="sm">
          <Text variant="title">Production patterns</Text>
          <Text tone="muted">
            Browse all 37 merged screens by domain. Each preview uses local demo state and public BeeUI APIs only.
          </Text>
        </VStack>

        <Box className="flex-row flex-wrap gap-4">
          {patternCatalog.map((domain) => (
            <Card className="min-w-[260px] flex-1 gap-4" key={domain.id} padding="lg" variant="raised">
              <VStack gap="sm">
                <HStack align="start" justify="between" wrap>
                  <Text className="min-w-0 flex-1" variant="heading">{domain.title}</Text>
                  <Badge variant="secondary">{`${domain.screens.length} screens`}</Badge>
                </HStack>
                <Text tone="muted">{domain.description}</Text>
              </VStack>
              <Button
                accessibilityLabel={`Open ${domain.title}`}
                onPress={() => onOpenDomain(domain.id)}
                variant="outline"
              >
                Browse domain
              </Button>
            </Card>
          ))}
        </Box>
      </Box>
    </ScrollView>
  );
}

function DomainScreenList({
  domain,
  onOpenScreen,
}: {
  domain: PatternDomain;
  onOpenScreen: (screen: PatternScreenDefinition) => void;
}) {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 80 }} style={{ flex: 1 }}>
      <Box className="mx-auto w-full max-w-4xl gap-5 px-4 py-6">
        <VStack gap="sm">
          <HStack gap="sm" wrap>
            <Badge>{domain.title}</Badge>
            <Badge variant="secondary">{`${domain.screens.length} screens`}</Badge>
          </HStack>
          <Text variant="title">Choose a screen</Text>
          <Text tone="muted">{domain.description}</Text>
        </VStack>

        <VStack gap="sm">
          {domain.screens.map((screen, index) => (
            <Card className="gap-3" key={screen.id} padding="lg" variant="outlined">
              <HStack align="start" gap="md" justify="between" wrap>
                <VStack className="min-w-[220px] flex-1" gap="xs">
                  <Text tone="subtle" variant="caption">{String(index + 1).padStart(2, '0')}</Text>
                  <Text variant="heading">{screen.title}</Text>
                  {screen.description ? <Text tone="muted">{screen.description}</Text> : null}
                </VStack>
                <Button
                  accessibilityLabel={`Open ${screen.title} pattern`}
                  onPress={() => onOpenScreen(screen)}
                  size="sm"
                  variant="outline"
                >
                  Preview
                </Button>
              </HStack>
            </Card>
          ))}
        </VStack>
      </Box>
    </ScrollView>
  );
}

function StateSelector({
  screen,
  stateId,
  onStateChange,
}: {
  screen: PatternScreenDefinition;
  stateId: string;
  onStateChange: (stateId: string) => void;
}) {
  if (!screen.states?.length) return null;

  return (
    <Box className="border-b border-border bg-surface px-3 py-3" testID="pattern-state-selector">
      <HStack align="center" gap="sm" wrap>
        <Text tone="muted" variant="caption">State</Text>
        {screen.states.map((state) => {
          const selected = state.id === stateId;
          return (
            <Button
              accessibilityLabel={`Show ${state.title} state`}
              accessibilityState={{ selected }}
              key={state.id}
              onPress={() => onStateChange(state.id)}
              size="sm"
              variant={selected ? 'secondary' : 'ghost'}
            >
              {state.title}
            </Button>
          );
        })}
      </HStack>
    </Box>
  );
}

function GallerySidebar({
  activeDomain,
  activeScreen,
  onOpenDomain,
  onOpenScreen,
}: {
  activeDomain: PatternDomain;
  activeScreen: PatternScreenDefinition;
  onOpenDomain: (domainId: string) => void;
  onOpenScreen: (screen: PatternScreenDefinition) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      style={{ flexGrow: 0, width: 300 }}
    >
      <Box className="w-[300px] gap-5 border-r border-border bg-surface px-3 py-4">
        <VStack gap="xs">
          <Text tone="muted" variant="caption">DOMAINS</Text>
          {patternCatalog.map((domain) => (
            <Button
              accessibilityLabel={`Switch to ${domain.title}`}
              accessibilityState={{ selected: domain.id === activeDomain.id }}
              key={domain.id}
              onPress={() => onOpenDomain(domain.id)}
              size="sm"
              variant={domain.id === activeDomain.id ? 'secondary' : 'ghost'}
            >
              {domain.title}
            </Button>
          ))}
        </VStack>

        <VStack gap="xs">
          <Text tone="muted" variant="caption">{activeDomain.title.toUpperCase()}</Text>
          {activeDomain.screens.map((screen) => (
            <Button
              accessibilityLabel={`Open ${screen.title} pattern`}
              accessibilityState={{ selected: screen.id === activeScreen.id }}
              key={screen.id}
              onPress={() => onOpenScreen(screen)}
              size="sm"
              variant={screen.id === activeScreen.id ? 'secondary' : 'ghost'}
            >
              {screen.title}
            </Button>
          ))}
        </VStack>
      </Box>
    </ScrollView>
  );
}

function PatternPreview({
  domain,
  screen,
  stateId,
  visitKey,
  onOpenDomain,
  onOpenScreen,
  onStateChange,
  wide,
}: {
  domain: PatternDomain;
  screen: PatternScreenDefinition;
  stateId: string;
  visitKey: number;
  onOpenDomain: (domainId: string) => void;
  onOpenScreen: (screen: PatternScreenDefinition) => void;
  onStateChange: (stateId: string) => void;
  wide: boolean;
}) {
  const Demo = screen.component;
  const preview = (
    <Box className="flex-1 overflow-hidden bg-background" testID={`pattern-preview-${screen.id}`}>
      <StateSelector onStateChange={onStateChange} screen={screen} stateId={stateId} />
      <Box className="flex-1">
        <Demo key={`${screen.id}:${visitKey}:${stateId}`} stateId={stateId} />
      </Box>
    </Box>
  );

  if (!wide) return preview;

  return (
    <Box className="flex-1 flex-row bg-background">
      <GallerySidebar
        activeDomain={domain}
        activeScreen={screen}
        onOpenDomain={onOpenDomain}
        onOpenScreen={onOpenScreen}
      />
      <Box className="flex-1 items-center bg-surface p-4">
        <Box
          className="h-full w-full overflow-hidden rounded-xl border border-border bg-background"
          style={{ maxWidth: 760 }}
          testID="pattern-desktop-canvas"
        >
          {preview}
        </Box>
      </Box>
    </Box>
  );
}

export function PatternGallery({ onBackToShowcase }: { onBackToShowcase?: () => void }) {
  const { width } = useWindowDimensions();
  const { theme } = useUniwind();
  const [domainId, setDomainId] = React.useState<string | null>(null);
  const [screenId, setScreenId] = React.useState<string | null>(null);
  const [stateId, setStateId] = React.useState('default');
  const [visitKey, setVisitKey] = React.useState(0);

  const domain = findPatternDomain(domainId);
  const screen = findPatternScreen(domain, screenId);
  const wide = width >= 960;

  const openDomain = React.useCallback((nextDomainId: string) => {
    setDomainId(nextDomainId);
    setScreenId(null);
    setStateId('default');
  }, []);

  const openScreen = React.useCallback((nextScreen: PatternScreenDefinition) => {
    setScreenId(nextScreen.id);
    setStateId(defaultPatternState(nextScreen));
    setVisitKey((current) => current + 1);
  }, []);

  const goBack = () => {
    if (screen) {
      setScreenId(null);
      setStateId('default');
      return;
    }
    if (domain) {
      setDomainId(null);
    }
  };

  const title = screen?.title ?? domain?.title ?? 'Pattern Gallery';
  const description = screen
    ? `${domain?.title ?? 'Patterns'} · local demo state resets when this screen is reopened`
    : domain?.description ?? 'Canonical product-quality browser for BeeUI production screen patterns.';

  const backButton = domain ? (
    <Button
      accessibilityLabel={screen ? 'Back to domain screen list' : 'Back to pattern domains'}
      onPress={goBack}
      size="sm"
      variant="ghost"
    >
      Back
    </Button>
  ) : onBackToShowcase ? (
    <Button
      accessibilityLabel="Back to Showcase home"
      testID="pattern-gallery-back"
      onPress={onBackToShowcase}
      size="sm"
      variant="ghost"
    >
      Back
    </Button>
  ) : undefined;

  return (
    <Screen testID="pattern-gallery">
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <SafeArea className="bg-surface" edges={['top', 'left', 'right']}>
        <AppHeader
          description={description}
          leading={backButton}
          title={title}
          trailing={<GalleryThemeControl />}
        />
      </SafeArea>

      <SafeArea className="flex-1 bg-background" edges={['left', 'right', 'bottom']}>
        {!domain ? (
          <GalleryHome onOpenDomain={openDomain} />
        ) : !screen ? (
          <DomainScreenList domain={domain} onOpenScreen={openScreen} />
        ) : (
          <PatternPreview
            domain={domain}
            onOpenDomain={openDomain}
            onOpenScreen={openScreen}
            onStateChange={setStateId}
            screen={screen}
            stateId={stateId}
            visitKey={visitKey}
            wide={wide}
          />
        )}
      </SafeArea>
    </Screen>
  );
}
