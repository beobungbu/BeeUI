import { isBeeDarkRuntimeTheme } from '@beemvp/beeui-tokens';
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
} from '@beemvp/beeui-ui';
import * as React from 'react';
import { ScrollView, StatusBar } from 'react-native';
import { Uniwind, useUniwind } from 'uniwind';
import appConfig from './app.json';
import { AddressableComponentGallery } from './component-gallery/addressable-component-gallery';
import { resolveShowcaseTarget } from './example-registry';
import { PatternGallery } from './pattern-gallery';
import {
  readShowcaseTargetFromLocation,
  subscribeToShowcaseHistory,
  writeShowcaseTargetToLocation,
} from './showcase-location';
import type { ShowcaseTarget } from './showcase-target';
import {
  DynamicTypeAcceptance,
  L10nStressAcceptance,
  RuntimeAcceptance,
  RuntimeStressAcceptance,
} from './runtime-smoke';
import { ThemeInspector } from './theme-inspector';

type ShowcaseSection =
  | 'home'
  | 'components'
  | 'dynamic-type'
  | 'l10n-stress'
  | 'patterns'
  | 'runtime'
  | 'runtime-stress'
  | 'tokens';

const SHOWCASE_VERSION = appConfig.expo.version;
const SHOWCASE_BUILD_SHA = process.env.EXPO_PUBLIC_BUILD_SHA ?? '';

function ShowcaseBuildIdentity() {
  const identity = SHOWCASE_BUILD_SHA
    ? `BeeUI Showcase v${SHOWCASE_VERSION} · build ${SHOWCASE_BUILD_SHA}`
    : `BeeUI Showcase v${SHOWCASE_VERSION} · local build`;

  return (
    <VStack gap="xs">
      <Text testID="showcase-build-identity" variant="caption">
        {identity}
      </Text>
      <Text variant="caption">
        Unpublished preview. The @beemvp/beeui-* packages and beeui CLI are not on npm yet; this
        Showcase is built from in-repo source.
      </Text>
    </VStack>
  );
}

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

function sectionForTarget(target: ShowcaseTarget): ShowcaseSection {
  if (target.surface === 'component') return 'components';
  if (target.surface === 'pattern') return 'patterns';
  if (target.surface === 'tokens') return 'tokens';
  if (target.id === 'dynamic-type') return 'dynamic-type';
  if (target.id === 'l10n-stress') return 'l10n-stress';
  return 'home';
}

function TargetRecovery({
  reason,
  recoveryTarget,
  onRecover,
  onHome,
}: {
  reason: string;
  recoveryTarget?: ShowcaseTarget;
  onRecover: (target: ShowcaseTarget) => void;
  onHome: () => void;
}) {
  return (
    <Screen testID="showcase-target-error">
      <SafeArea className="flex-1 bg-background" edges={['top', 'left', 'right', 'bottom']}>
        <Box className="mx-auto w-full max-w-xl flex-1 justify-center gap-5 px-5 py-8">
          <Badge variant="warning">Target recovery</Badge>
          <VStack gap="sm">
            <Text variant="title">Example not found</Text>
            <Text testID="showcase-target-error-message" tone="muted">{reason}</Text>
            <Text tone="subtle" variant="caption">
              The URL was preserved as an explicit error instead of silently pretending that Showcase Home is the requested example.
            </Text>
          </VStack>
          <HStack gap="sm" wrap>
            {recoveryTarget ? (
              <Button onPress={() => onRecover(recoveryTarget)} testID="showcase-target-recover">
                Open canonical target
              </Button>
            ) : null}
            <Button onPress={onHome} testID="showcase-target-home" variant="outline">
              Browse Showcase
            </Button>
          </HStack>
          <ShowcaseBuildIdentity />
        </Box>
      </SafeArea>
    </Screen>
  );
}

export function ShowcaseRoot() {
  const { theme } = useUniwind();
  const initialTarget = React.useMemo(() => readShowcaseTargetFromLocation(), []);
  const initialResolution = React.useMemo(
    () => initialTarget ? resolveShowcaseTarget(initialTarget) : null,
    [initialTarget],
  );
  const [section, setSection] = React.useState<ShowcaseSection>(() =>
    initialResolution?.ok ? sectionForTarget(initialResolution.target) : 'home',
  );
  const [publicTarget, setPublicTarget] = React.useState<ShowcaseTarget | null>(() =>
    initialResolution?.ok ? initialResolution.target : initialTarget,
  );
  const [targetError, setTargetError] = React.useState<
    { reason: string; recoveryTarget?: ShowcaseTarget } | null
  >(() => initialResolution && !initialResolution.ok
    ? { reason: initialResolution.reason, recoveryTarget: initialResolution.recoveryTarget }
    : null);

  const applyTarget = React.useCallback((target: ShowcaseTarget | null, mode: 'push' | 'replace' | 'history' = 'push') => {
    if (!target) {
      setPublicTarget(null);
      setTargetError(null);
      if (mode === 'history') setSection('home');
      if (mode !== 'history') writeShowcaseTargetToLocation(null, mode);
      return;
    }

    const resolved = resolveShowcaseTarget(target);
    if (!resolved.ok) {
      setPublicTarget(target);
      setTargetError({ reason: resolved.reason, recoveryTarget: resolved.recoveryTarget });
      if (mode !== 'history') writeShowcaseTargetToLocation(target, mode);
      return;
    }

    setTargetError(null);
    setPublicTarget(resolved.target);
    setSection(sectionForTarget(resolved.target));
    if (mode !== 'history') writeShowcaseTargetToLocation(resolved.target, mode);
  }, []);

  React.useEffect(() => subscribeToShowcaseHistory((target) => applyTarget(target, 'history')), [applyTarget]);

  const goHome = React.useCallback(() => {
    setSection('home');
    applyTarget(null, 'push');
  }, [applyTarget]);

  const openSection = React.useCallback((nextSection: ShowcaseSection) => {
    setSection(nextSection);
    setPublicTarget(null);
    setTargetError(null);
    writeShowcaseTargetToLocation(null, 'push');
  }, []);

  if (targetError) {
    return (
      <TargetRecovery
        onHome={goHome}
        onRecover={(target) => applyTarget(target, 'replace')}
        reason={targetError.reason}
        recoveryTarget={targetError.recoveryTarget}
      />
    );
  }

  if (section === 'components') {
    // Browsing Components without an addressed target must stay the plain gallery.
    // Synthesizing a default exact target here would put target chrome over the
    // gallery for every visitor who never asked for one.
    return (
      <AddressableComponentGallery
        onBack={goHome}
        onTargetChange={(target) => applyTarget(target, 'push')}
        target={publicTarget?.surface === 'component' ? publicTarget : null}
      />
    );
  }

  if (section === 'patterns') {
    return (
      <PatternGallery
        onBackToShowcase={goHome}
        onTargetChange={(target) => {
          if (target) applyTarget(target, 'push');
          else {
            setPublicTarget(null);
            writeShowcaseTargetToLocation(null, 'push');
          }
        }}
        target={publicTarget?.surface === 'pattern' ? publicTarget : null}
      />
    );
  }

  if (section === 'tokens') {
    return <ThemeInspector onBack={goHome} />;
  }

  if (section === 'runtime') {
    return <RuntimeAcceptance onBack={goHome} />;
  }

  if (section === 'runtime-stress') {
    return <RuntimeStressAcceptance onBack={goHome} />;
  }

  if (section === 'dynamic-type') {
    return <DynamicTypeAcceptance onBack={goHome} />;
  }

  if (section === 'l10n-stress') {
    return <L10nStressAcceptance onBack={goHome} />;
  }

  return (
    <Screen testID="showcase-home">
      <StatusBar
        barStyle={isBeeDarkRuntimeTheme(String(theme)) || theme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <SafeArea className="flex-1 bg-background" edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 64 }}>
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
                Public example identity is serialized into the URL on Web without introducing an application router. Native selection remains local React state.
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
                  onPress={() => openSection('components')}
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
                  onPress={() => openSection('tokens')}
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
                  onPress={() => openSection('patterns')}
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
                  onPress={() => openSection('runtime')}
                  testID="showcase-open-runtime"
                  variant="outline"
                >
                  Open runtime acceptance
                </Button>
              </Card>

              <Card className="min-w-[260px] flex-1 gap-5" padding="lg" variant="raised">
                <VStack gap="sm">
                  <HStack align="start" justify="between" wrap>
                    <Text variant="heading">Runtime stress</Text>
                    <Badge variant="info">QA</Badge>
                  </HStack>
                  <Text tone="muted">
                    Isolated #126 native movement/scroll/keyboard stress: root Select, Popover movement coherence, and modal-local child overlays under a real keyboard.
                  </Text>
                </VStack>
                <Button
                  accessibilityLabel="Open Runtime Stress fixture"
                  onPress={() => openSection('runtime-stress')}
                  testID="showcase-open-runtime-stress"
                  variant="outline"
                >
                  Open Runtime Stress fixture
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
                  onPress={() => applyTarget({ surface: 'fixture', id: 'dynamic-type' }, 'push')}
                  testID="showcase-open-dynamic-type"
                  variant="outline"
                >
                  Open Dynamic Type fixture
                </Button>
              </Card>

              <Card className="min-w-[260px] flex-1 gap-5" padding="lg" variant="raised">
                <VStack gap="sm">
                  <HStack align="start" justify="between" wrap>
                    <Text variant="heading">Localization stress</Text>
                    <Badge variant="info">QA</Badge>
                  </HStack>
                  <Text tone="muted">
                    Deterministic long-content/localization fixture: long words, CJK, Arabic RTL, and pseudo-localized profiles across Tooltip, Sheet, Table, DatePicker, forms, Settings, Toast, and navigation chrome.
                  </Text>
                </VStack>
                <Button
                  accessibilityLabel="Open Localization stress fixture"
                  onPress={() => applyTarget({ surface: 'fixture', id: 'l10n-stress' }, 'push')}
                  testID="showcase-open-l10n-stress"
                  variant="outline"
                >
                  Open Localization stress fixture
                </Button>
              </Card>
            </Box>

            <ShowcaseBuildIdentity />
          </Box>
        </ScrollView>
      </SafeArea>
    </Screen>
  );
}
