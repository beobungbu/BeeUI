import { isBeeDarkRuntimeTheme } from '@beeui/tokens';
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
import { ScrollView, StatusBar } from 'react-native';
import { Uniwind, useUniwind } from 'uniwind';
import { ComponentGallery } from './component-gallery';
import { PatternGallery } from './pattern-gallery';
import { DynamicTypeAcceptance, RuntimeAcceptance } from './runtime-smoke';
import { ThemeInspector } from './theme-inspector';

type ShowcaseSection = 'home' | 'components' | 'dynamic-type' | 'patterns' | 'runtime' | 'tokens';

function ShowcaseThemeControl() {
  const { hasAdaptiveThemes, theme } = useUniwind();
  const activeTheme = hasAdaptiveThemes ? 'system' : String(theme);
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

export function ShowcaseRoot() {
  const { theme } = useUniwind();
  const [section, setSection] = React.useState<ShowcaseSection>('home');

  if (section === 'components') {
    return <ComponentGallery onBack={() => setSection('home')} />;
  }

  if (section === 'patterns') {
    return <PatternGallery onBackToShowcase={() => setSection('home')} />;
  }

  if (section === 'tokens') {
    return <ThemeInspector onBack={() => setSection('home')} />;
  }

  if (section === 'runtime') {
    return <RuntimeAcceptance onBack={() => setSection('home')} />;
  }

  if (section === 'dynamic-type') {
    return <DynamicTypeAcceptance onBack={() => setSection('home')} />;
  }

  return (
    <Screen testID="showcase-home">
      <StatusBar
        barStyle={isBeeDarkRuntimeTheme(String(theme)) || theme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <SafeArea className="flex-1 bg-background" edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 64 }}>
          {/*
            The header scrolls with the catalog instead of sitting above it as
            fixed chrome: at large font scales (~2x) its scaled title/description
            alone can exceed the viewport height, and any fixed region that tall
            would leave the scrollable launcher list zero usable height, making
            every surface below unreachable (runtime automation included). Home
            must stay navigable at every audited Dynamic Type scale.
          */}
          <Box className="bg-surface">
            <AppHeader
description="Inspect the public component system, semantic theme foundation, production pattern library, and native runtime acceptance from one executable Showcase."
title="BeeUI Showcase"
trailing={<ShowcaseThemeControl />}
            />
          </Box>
<Box className="mx-auto w-full max-w-4xl gap-6 px-5 py-8">
  <VStack gap="sm">
    <Text variant="title">Choose an inspection surface</Text>
    <Text tone="muted">
      Only the selected surface is mounted. Showcase navigation uses local React state and owns no router.
    </Text>
  </VStack>

  <Box className="flex-row flex-wrap gap-4">
    <Card className="min-w-[260px] flex-1 gap-5" padding="lg" variant="raised">
      <VStack gap="sm">
        <HStack align="start" justify="between" wrap>
          <Text variant="heading">Components</Text>
          <Badge variant="secondary">Interactive</Badge>
        </HStack>
        <Text tone="muted">
          Inspect foundation, forms, feedback, overlays, selection, navigation, disclosure, data, and application composition.
        </Text>
      </VStack>
      <Button
        accessibilityLabel="Open Components"
        onPress={() => setSection('components')}
        testID="showcase-open-components"
        variant="outline"
      >
        Browse components
      </Button>
    </Card>

    <Card className="min-w-[260px] flex-1 gap-5" padding="lg" variant="raised">
      <VStack gap="sm">
        <HStack align="start" justify="between" wrap>
          <Text variant="heading">Theme & tokens</Text>
          <Badge variant="secondary">v2</Badge>
        </HStack>
        <Text tone="muted">
          Inspect semantic colors, typography, sizing, elevation, focus, motion policy, and Brand A/B light-dark switching.
        </Text>
      </VStack>
      <Button
        accessibilityLabel="Open Theme and tokens"
        onPress={() => setSection('tokens')}
        testID="showcase-open-theme-tokens"
        variant="outline"
      >
        Inspect theme
      </Button>
    </Card>

    <Card className="min-w-[260px] flex-1 gap-5" padding="lg" variant="raised">
      <VStack gap="sm">
        <HStack align="start" justify="between" wrap>
          <Text variant="heading">Patterns</Text>
          <Badge variant="secondary">37 screens</Badge>
        </HStack>
        <Text tone="muted">
          Browse four production domains with controlled demo state, responsive previews, state inspection, and light/dark support.
        </Text>
      </VStack>
      <Button
        accessibilityLabel="Open Patterns"
        onPress={() => setSection('patterns')}
        testID="showcase-open-patterns"
        variant="outline"
      >
        Browse patterns
      </Button>
    </Card>

    <Card className="min-w-[260px] flex-1 gap-5" padding="lg" variant="raised">
      <VStack gap="sm">
        <HStack align="start" justify="between" wrap>
          <Text variant="heading">Runtime acceptance</Text>
          <Badge variant="info">QA</Badge>
        </HStack>
        <Text tone="muted">
          Stable native-only fixtures for simulator/emulator smoke, sheet presentation, hardware Back, keyboard, safe area, and evidence capture.
        </Text>
      </VStack>
      <Button
        accessibilityLabel="Open Runtime Acceptance"
        onPress={() => setSection('runtime')}
        testID="showcase-open-runtime"
        variant="outline"
      >
        Open runtime acceptance
      </Button>
    </Card>

    <Card className="min-w-[260px] flex-1 gap-5" padding="lg" variant="raised">
      <VStack gap="sm">
        <HStack align="start" justify="between" wrap>
          <Text variant="heading">Dynamic Type</Text>
          <Badge variant="info">QA</Badge>
        </HStack>
        <Text tone="muted">
          Deterministic font-scaling fixture: audited growable rows and allow-listed fixed-height exceptions, measurable one tap from home without gallery traversal.
        </Text>
      </VStack>
      <Button
        accessibilityLabel="Open Dynamic Type fixture"
        onPress={() => setSection('dynamic-type')}
        testID="showcase-open-dynamic-type"
        variant="outline"
      >
        Open Dynamic Type fixture
      </Button>
    </Card>
  </Box>
</Box>
        </ScrollView>
      </SafeArea>
    </Screen>
  );
}
