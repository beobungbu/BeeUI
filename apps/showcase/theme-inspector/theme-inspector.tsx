import {
  getBeeThemeSelection,
  resolveBeeRuntimeTheme,
  type BeeBrandName,
  type BeeThemeName,
} from '@beeui/tokens';
import {
  AppHeader,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  HStack,
  Input,
  SafeArea,
  Screen,
  Text,
  VStack,
} from '@beeui/ui';
import * as React from 'react';
import { ScrollView } from 'react-native';
import { Uniwind, useUniwind } from 'uniwind';

type ThemeInspectorProps = {
  onBack: () => void;
};

const semanticColorSamples = [
  { label: 'Background', className: 'bg-background' },
  { label: 'Surface', className: 'bg-surface border border-border' },
  { label: 'Surface muted', className: 'bg-surface-muted' },
  { label: 'Surface raised', className: 'bg-surface-raised border border-border' },
  { label: 'Primary', className: 'bg-primary' },
  { label: 'Secondary', className: 'bg-secondary' },
  { label: 'Destructive', className: 'bg-destructive' },
  { label: 'Success', className: 'bg-success' },
  { label: 'Warning', className: 'bg-warning' },
  { label: 'Info', className: 'bg-info' },
  { label: 'Disabled', className: 'bg-disabled' },
  { label: 'Focus ring', className: 'bg-focus-ring' },
] as const;

function InspectorSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <Card className="gap-5" padding="lg" variant="outlined">
      <VStack gap="xs">
        <Text variant="heading">{title}</Text>
        {description ? <Text tone="muted">{description}</Text> : null}
      </VStack>
      {children}
    </Card>
  );
}

function applyRuntimeTheme(brand: BeeBrandName, mode: BeeThemeName) {
  const runtimeTheme = resolveBeeRuntimeTheme(brand, mode);
  Uniwind.setTheme(runtimeTheme as Parameters<typeof Uniwind.setTheme>[0]);
}

export function ThemeInspector({ onBack }: ThemeInspectorProps) {
  const { theme } = useUniwind();
  const runtimeTheme = String(theme);
  const selection = getBeeThemeSelection(runtimeTheme);
  const activeBrand: BeeBrandName = selection?.brand ?? 'bee';
  const activeMode: BeeThemeName = selection?.theme ?? (runtimeTheme === 'dark' ? 'dark' : 'light');

  return (
    <Screen testID="theme-token-inspector">
      <SafeArea className="bg-surface" edges={['top', 'left', 'right']}>
        <AppHeader
          description="Inspect semantic theme contracts, token scale, branding, focus, and cross-platform policy without product-screen semantics."
          leading={
            <Button accessibilityLabel="Back to Showcase home" onPress={onBack} size="sm" variant="ghost">
              Back
            </Button>
          }
          title="Theme & token inspector"
        />
      </SafeArea>

      <SafeArea className="flex-1 bg-background" edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 64 }}>
          <Box className="mx-auto w-full max-w-page gap-6 px-5 py-8">
            <InspectorSection
              description="Both brands consume the same semantic component contracts. Switching changes theme variables, not component source."
              title="Runtime branding"
            >
              <VStack gap="md">
                <HStack gap="sm" wrap>
                  <Button
                    accessibilityLabel="Use Brand A Bee"
                    onPress={() => applyRuntimeTheme('bee', activeMode)}
                    variant={activeBrand === 'bee' ? 'primary' : 'outline'}
                  >
                    Brand A · Bee
                  </Button>
                  <Button
                    accessibilityLabel="Use Brand B Violet"
                    onPress={() => applyRuntimeTheme('violet', activeMode)}
                    variant={activeBrand === 'violet' ? 'primary' : 'outline'}
                  >
                    Brand B · Violet
                  </Button>
                </HStack>
                <HStack gap="sm" wrap>
                  <Button
                    accessibilityLabel="Use light theme"
                    onPress={() => applyRuntimeTheme(activeBrand, 'light')}
                    size="sm"
                    variant={activeMode === 'light' ? 'secondary' : 'outline'}
                  >
                    Light
                  </Button>
                  <Button
                    accessibilityLabel="Use dark theme"
                    onPress={() => applyRuntimeTheme(activeBrand, 'dark')}
                    size="sm"
                    variant={activeMode === 'dark' ? 'secondary' : 'outline'}
                  >
                    Dark
                  </Button>
                  <Badge variant="secondary">{runtimeTheme}</Badge>
                </HStack>
                <Card className="gap-4" variant="raised">
                  <Text variant="title">Semantic branding proof</Text>
                  <Text tone="muted">
                    Primary actions, surfaces, inputs, borders, status colors, and focus derive from the active semantic theme.
                  </Text>
                  <Input accessibilityLabel="Brand-aware input" placeholder="Brand-aware input" />
                  <HStack gap="sm" wrap>
                    <Button>Primary action</Button>
                    <Button variant="outline">Secondary action</Button>
                  </HStack>
                </Card>
              </VStack>
            </InspectorSection>

            <InspectorSection
              description="Public component contracts consume intent such as surface, primary, danger, status, border, and focus—not raw palette names."
              title="Semantic colors"
            >
              <Box className="flex-row flex-wrap gap-4">
                {semanticColorSamples.map((sample) => (
                  <VStack key={sample.label} className="min-w-[132px] flex-1" gap="xs">
                    <Box className={`h-16 rounded-md ${sample.className}`} />
                    <Text variant="caption">{sample.label}</Text>
                  </VStack>
                ))}
              </Box>
              <Text tone="subtle" variant="caption">
                Subtle and disabled foregrounds are intentionally lower-emphasis roles and are not approved for normal body copy.
              </Text>
            </InspectorSection>

            <InspectorSection
              description="One semantic role owns size and line height. Numeric Tailwind typography remains an implementation escape hatch, not the design-system contract."
              title="Typography"
            >
              <VStack gap="md">
                <Text variant="display">Display · 32 / 40</Text>
                <Text variant="title">Title · 24 / 32</Text>
                <Text variant="heading">Heading · 18 / 24</Text>
                <Text variant="body">Body · 16 / 24</Text>
                <Text variant="label">Label · 14 / 20</Text>
                <Text variant="caption">Caption · 12 / 16</Text>
                <Text tone="muted">
                  Default font family remains the platform system font. A mono family is deliberately absent until product evidence justifies one.
                </Text>
              </VStack>
            </InspectorSection>

            <InspectorSection
              description="Compact controls remain 36 px on web; iOS and Android enforce the 44 px minimum touch target. Default and icon controls are 44 px, large is 48 px."
              title="Controls & focus"
            >
              <VStack gap="md">
                <HStack align="center" gap="sm" wrap>
                  <Button size="sm">Compact</Button>
                  <Button size="md">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button accessibilityLabel="Icon-only token sample" size="icon">+</Button>
                </HStack>
                <Input accessibilityLabel="Compact input" placeholder="Compact input" size="sm" />
                <Input accessibilityLabel="Default input" placeholder="Default input" size="md" />
                <Text tone="muted" variant="caption">
                  Web keyboard focus uses a 2 px semantic focus ring with 2 px offset via focus-visible. Native focus indication follows platform semantics.
                </Text>
              </VStack>
            </InspectorSection>

            <InspectorSection
              description="Icon tokens describe geometry, not an icon-library API. Avatar sizes reflect recurring product-pattern evidence."
              title="Icon & avatar sizing"
            >
              <HStack align="end" gap="lg" wrap>
                <VStack align="center" gap="xs">
                  <Box className="h-icon-xs w-icon-xs rounded-sm bg-primary" />
                  <Text variant="caption">xs 12</Text>
                </VStack>
                <VStack align="center" gap="xs">
                  <Box className="h-icon-sm w-icon-sm rounded-sm bg-primary" />
                  <Text variant="caption">sm 16</Text>
                </VStack>
                <VStack align="center" gap="xs">
                  <Box className="h-icon-md w-icon-md rounded-sm bg-primary" />
                  <Text variant="caption">md 20</Text>
                </VStack>
                <VStack align="center" gap="xs">
                  <Box className="h-icon-lg w-icon-lg rounded-sm bg-primary" />
                  <Text variant="caption">lg 24</Text>
                </VStack>
              </HStack>
              <HStack align="end" gap="md" wrap>
                <Avatar fallback="A" size="sm" />
                <Avatar fallback="B" size="md" />
                <Avatar fallback="C" size="lg" />
                <Avatar fallback="D" size="xl" />
              </HStack>
            </InspectorSection>

            <InspectorSection
              description="Max-width tokens express reusable content intent. They constrain web layouts while remaining ordinary max-width utilities that do not assume a browser-only layout model."
              title="Content width"
            >
              <VStack gap="sm">
                <Box className="w-full max-w-form rounded-md border border-border bg-surface-muted p-3">
                  <Text variant="caption">form · 512 px</Text>
                </Box>
                <Box className="w-full max-w-reading rounded-md border border-border bg-surface-muted p-3">
                  <Text variant="caption">reading · 704 px</Text>
                </Box>
                <Box className="w-full max-w-page rounded-md border border-border bg-surface-muted p-3">
                  <Text variant="caption">page · 1152 px</Text>
                </Box>
                <Box className="w-full max-w-dialog rounded-md border border-border bg-surface-muted p-3">
                  <Text variant="caption">dialog · 512 px</Text>
                </Box>
              </VStack>
            </InspectorSection>

            <InspectorSection
              description="Elevation communicates semantic layering. Web shadows and native elevation/shadow support are best-effort mappings; pixel identity across platforms is not promised."
              title="Elevation"
            >
              <Box className="flex-row flex-wrap gap-4">
                <Card className="min-w-[180px] flex-1 shadow-flat" padding="lg">
                  <Text variant="label">Flat</Text>
                </Card>
                <Card className="min-w-[180px] flex-1 shadow-raised" padding="lg">
                  <Text variant="label">Raised</Text>
                </Card>
                <Card className="min-w-[180px] flex-1 shadow-overlay" padding="lg">
                  <Text variant="label">Overlay</Text>
                </Card>
              </Box>
            </InspectorSection>

            <InspectorSection
              description="Durations are fast 120 ms, normal 200 ms, slow 320 ms. Tokens do not imply that every state should animate."
              title="Motion & reduced motion"
            >
              <VStack gap="sm">
                <Text>Use semantic duration and easing only where motion clarifies state or spatial continuity.</Text>
                <Text tone="muted">
                  CSS transitions must provide a motion-reduce path. JavaScript-driven motion must consult the platform reduced-motion preference and skip or simplify non-essential motion.
                </Text>
              </VStack>
            </InspectorSection>
          </Box>
        </ScrollView>
      </SafeArea>
    </Screen>
  );
}
