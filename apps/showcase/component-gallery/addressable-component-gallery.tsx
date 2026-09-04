import {
  Badge,
  Box,
  Button,
  Card,
  HStack,
  SafeArea,
  Screen,
  Stack,
  Text,
  VStack,
} from '@beemvp/beeui-ui';
import * as React from 'react';
import { ScrollView } from 'react-native';
import { focusComponentTarget } from '../component-target-focus';
import { componentExamples, findShowcaseExample } from '../example-registry';
import type { ShowcaseTarget } from '../showcase-target';
import { SettingsScreenShell } from '../patterns/account-settings/components/settings-screen-shell';
import { ComponentGallery } from './component-gallery';
import { DatePickerShowcase } from './date-picker-showcase';
import { DateTimePickerShowcase } from './date-time-picker-showcase';
import { PublicDocFixtures } from './public-doc-fixtures';
import { SelectShowcase } from './select-showcase';
import { TableShowcase } from './table-showcase';

function PrimitiveFixture({ ownerId }: { ownerId: string }) {
  if (ownerId === 'badge') return <Badge variant="success">Badge exact fixture</Badge>;
  if (ownerId === 'box') return <Box className="rounded-lg border border-border p-5"><Text>Box exact fixture</Text></Box>;
  if (ownerId === 'card') return <Card padding="lg" variant="raised"><Text>Card exact fixture</Text></Card>;
  if (ownerId === 'stack') return <Stack gap="sm"><Text>Stack item one</Text><Text>Stack item two</Text></Stack>;
  return <Text variant="heading">Text exact fixture</Text>;
}

function ExactFixture({ sourcePath, ownerId }: { sourcePath: string; ownerId: string }) {
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
  if (sourcePath.endsWith('/addressable-component-gallery.tsx')) return <PrimitiveFixture ownerId={ownerId} />;
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

export function AddressableComponentGallery({
  onBack,
  onTargetChange,
  target,
}: {
  onBack: () => void;
  onTargetChange: (target: ShowcaseTarget) => void;
  target: ShowcaseTarget;
}) {
  const example = findShowcaseExample(target);
  const dedicated = example ? ExactFixture({ sourcePath: example.sourcePath, ownerId: example.ownerId }) : null;

  React.useEffect(() => {
    if (!example) return undefined;
    return focusComponentTarget(
      dedicated
        ? { focusTestId: example.focusTestId ?? 'showcase-exact-fixture', focusText: example.focusText }
        : { focusTestId: example.focusTestId, focusText: example.focusText },
    );
  }, [dedicated, example]);

  if (!example) return <ComponentGallery onBack={onBack} />;

  if (dedicated) {
    return (
      <Screen testID="addressable-component-gallery">
        <SafeArea className="bg-surface" edges={['top', 'left', 'right']}>
          <Box className="mx-auto w-full max-w-4xl gap-3 px-4 py-3">
            <Button onPress={onBack} size="sm" testID="component-gallery-back" variant="ghost">Back</Button>
            <TargetInspector example={example} onTargetChange={onTargetChange} />
          </Box>
        </SafeArea>
        <SafeArea className="flex-1 bg-background" edges={['left', 'right', 'bottom']}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}>
            <Box
              className="mx-auto w-full max-w-4xl gap-6 px-5 py-6"
              testID="showcase-exact-fixture"
            >
              {dedicated}
            </Box>
          </ScrollView>
        </SafeArea>
      </Screen>
    );
  }

  return (
    <Box className="flex-1" testID="addressable-component-gallery">
      <ComponentGallery onBack={onBack} />
      <Box
        className="pointer-events-box-none absolute left-3 right-3 top-3 z-50 items-center"
        testID="showcase-active-example"
      >
        <TargetInspector example={example} onTargetChange={onTargetChange} />
      </Box>
    </Box>
  );
}
