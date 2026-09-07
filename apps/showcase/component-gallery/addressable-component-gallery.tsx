import {
  Badge,
  Box,
  Button,
  Card,
  HStack,
  SafeArea,
  Screen,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';
import { ScrollView } from 'react-native';
import { focusComponentTarget } from '../component-target-focus';
import { componentExamples, findShowcaseExample } from '../example-registry';
import { writeShowcaseTargetToLocation } from '../showcase-location';
import type { ShowcaseTarget } from '../showcase-target';
import { SettingsScreenShell } from '../patterns/account-settings/components/settings-screen-shell';
import { ComponentGallery } from './component-gallery';
import { DatePickerShowcase } from './date-picker-showcase';
import { DateTimePickerShowcase } from './date-time-picker-showcase';
import { PublicDocFixtures } from './public-doc-fixtures';
import { SelectShowcase } from './select-showcase';
import { TableShowcase } from './table-showcase';

/**
 * Registry source paths that are rendered as a standalone fixture rather than as a
 * position inside the main Component Gallery. Everything else keeps the real gallery
 * as its executable body and is located inside it by the focus seam.
 */
const DEDICATED_FIXTURE_SOURCES = [
  '/select-showcase.tsx',
  '/table-showcase.tsx',
  '/date-picker-showcase.tsx',
  '/date-time-picker-showcase.tsx',
  '/public-doc-fixtures.tsx',
  '/settings-screen-shell.tsx',
];

function hasDedicatedFixture(sourcePath: string) {
  return DEDICATED_FIXTURE_SOURCES.some((suffix) => sourcePath.endsWith(suffix));
}

function ExactFixture({ sourcePath }: { sourcePath: string }) {
  if (sourcePath.endsWith('/select-showcase.tsx')) return <SelectShowcase />;
  if (sourcePath.endsWith('/table-showcase.tsx')) return <TableShowcase />;
  if (sourcePath.endsWith('/date-picker-showcase.tsx')) return <DatePickerShowcase />;
  if (sourcePath.endsWith('/date-time-picker-showcase.tsx')) return <DateTimePickerShowcase />;
  if (sourcePath.endsWith('/public-doc-fixtures.tsx')) return <PublicDocFixtures />;
  if (sourcePath.endsWith('/settings-screen-shell.tsx')) {
    return (
      <SettingsScreenShell
        description="Addressable runtime fixture for the public KeyboardAwareScreen family."
        keyboardAware
        testID="keyboard-aware-screen-exact-fixture"
        title="Keyboard-aware screen"
      >
        <Text>Focused content remains reachable when the keyboard changes the usable viewport.</Text>
      </SettingsScreenShell>
    );
  }
  return null;
}

function TargetInspector({
  example,
  onTargetChange,
}: {
  example: NonNullable<ReturnType<typeof findShowcaseExample>>;
  onTargetChange: (target: ShowcaseTarget) => void;
}) {
  const examples = componentExamples.filter((entry) => entry.ownerId === example.ownerId);
  return (
    <Card className="w-full max-w-2xl gap-3 border border-primary bg-surface" padding="sm" variant="raised">
      <HStack align="center" gap="sm" wrap>
        <Badge variant="secondary">Exact target</Badge>
        <Text testID="showcase-active-example-label" variant="label">{`${example.ownerId} / ${example.id}`}</Text>
      </HStack>
      <Text tone="muted" variant="caption">{example.intent}</Text>
      <Text testID="showcase-active-example-source" tone="subtle" variant="caption">
        {example.sourcePath}
      </Text>
      {examples.length > 1 ? (
        <HStack gap="xs" wrap>
          {examples.map((entry) => (
            <Button
              key={entry.id}
              onPress={() => onTargetChange(entry.showcaseTarget)}
              size="sm"
              testID={`showcase-example-${entry.id}`}
              variant={entry.id === example.id ? 'secondary' : 'ghost'}
            >
              {entry.id}
            </Button>
          ))}
        </HStack>
      ) : null}
    </Card>
  );
}

/**
 * Renders the exact component target named by `target`.
 *
 * The component is controlled: the caller owns target identity so that browser
 * Back/Forward and in-app example switching cannot diverge into two sources of truth.
 * Without a resolvable target it renders the plain Component Gallery, so ordinary
 * browsing never gains exact-target chrome it did not ask for.
 */
export function AddressableComponentGallery({
  onBack,
  onTargetChange,
  target,
}: {
  onBack: () => void;
  onTargetChange?: (target: ShowcaseTarget) => void;
  target: ShowcaseTarget | null;
}) {
  const example = target ? findShowcaseExample(target) : undefined;
  const dedicated = Boolean(example && hasDedicatedFixture(example.sourcePath));

  const changeTarget = React.useCallback((nextTarget: ShowcaseTarget) => {
    if (onTargetChange) onTargetChange(nextTarget);
    else writeShowcaseTargetToLocation(nextTarget, 'push');
  }, [onTargetChange]);

  React.useEffect(() => {
    if (!example) return undefined;
    return focusComponentTarget(
      dedicated
        ? { focusTestId: example.focusTestId ?? 'showcase-exact-fixture', focusText: example.focusText }
        : { focusTestId: example.focusTestId, focusText: example.focusText },
    );
  }, [dedicated, example?.id, example?.ownerId, example?.focusTestId, example?.focusText]);

  if (!example) return <ComponentGallery onBack={onBack} />;

  if (dedicated) {
    return (
      <Screen testID="addressable-component-gallery">
        <SafeArea className="bg-surface" edges={['top', 'left', 'right']}>
          <Box className="mx-auto w-full max-w-4xl gap-3 px-4 py-3">
            <Button onPress={onBack} size="sm" testID="component-gallery-back" variant="ghost">Back</Button>
            <TargetInspector example={example} onTargetChange={changeTarget} />
          </Box>
        </SafeArea>
        <SafeArea className="flex-1 bg-background" edges={['left', 'right', 'bottom']}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}>
            <Box
              className="mx-auto w-full max-w-4xl gap-6 px-5 py-6"
              testID="showcase-exact-fixture"
            >
              <ExactFixture sourcePath={example.sourcePath} />
            </Box>
          </ScrollView>
        </SafeArea>
      </Screen>
    );
  }

  // The inspector stays in normal document flow above the gallery. An overlay here
  // would sit on top of the gallery's own header and controls and swallow their taps.
  return (
    <Box className="flex-1" testID="addressable-component-gallery">
      <SafeArea className="bg-surface" edges={['top', 'left', 'right']}>
        <Box className="mx-auto w-full max-w-4xl px-4 py-3" testID="showcase-active-example">
          <TargetInspector example={example} onTargetChange={changeTarget} />
        </Box>
      </SafeArea>
      <Box className="flex-1">
        <ComponentGallery onBack={onBack} />
      </Box>
    </Box>
  );
}
