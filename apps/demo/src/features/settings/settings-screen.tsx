import {
  AlertBanner,
  Card,
  KeyboardAwareScreen,
  ListGroup,
  ListGroupHeader,
  ListItem,
  SegmentedControl,
  SegmentedControlItem,
  Section,
  Separator,
  SettingsItem,
  Text,
  VStack,
  useToast,
} from '@beemvp/beeui-ui';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { useDemoScenario, type DemoScenario } from '../../state/demo-scenario';
import {
  useAppPreferences,
  type DirectionPreference,
  type TextScalePreference,
  type ThemePreference,
} from '../../state/preferences';

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

const DENSITY_OPTIONS: { label: string; value: 'compact' | 'comfortable' | 'spacious' }[] = [
  { label: 'Compact', value: 'compact' },
  { label: 'Comfortable', value: 'comfortable' },
  { label: 'Spacious', value: 'spacious' },
];

const DIRECTION_OPTIONS: { label: string; value: DirectionPreference }[] = [
  { label: 'LTR', value: 'ltr' },
  { label: 'RTL', value: 'rtl' },
];

const TEXT_SCALE_OPTIONS: { label: string; value: TextScalePreference }[] = [
  { label: 'Default', value: 'default' },
  { label: 'Large', value: 'large' },
  { label: 'Largest', value: 'largest' },
];

const DEMO_SCENARIO_OPTIONS: { label: string; value: DemoScenario }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'Empty data', value: 'empty' },
  { label: 'Network error', value: 'error' },
];

function useReducedMotionStatus(): boolean {
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!cancelled) setReducedMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReducedMotion(value);
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

export function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { density, direction, setDensity, setDirection, setTextScale, setTheme, textScale, theme } =
    useAppPreferences();
  const { scenario, setScenario } = useDemoScenario();
  const reducedMotion = useReducedMotionStatus();

  function handleDirectionChange(next: DirectionPreference) {
    const { restartRequired } = setDirection(next);
    if (restartRequired) {
      toast.show({
        title: 'Restart required',
        description: 'React Native does not re-mirror an already-mounted app. Restart the app to apply the new direction.',
        variant: 'warning',
        duration: 6000,
      });
    }
  }

  return (
    <KeyboardAwareScreen contentWidth="md">
      <VStack className="py-4" gap="lg">
        <VStack gap="xs">
          <Text variant="title">Settings</Text>
          <Text tone="muted" variant="body">
            Theme, density, accessibility, and demo data preferences.
          </Text>
        </VStack>

        {scenario !== 'normal' ? (
          <AlertBanner
            description="Dashboard, records, and schedule screens are showing simulated data for this scenario."
            testID="settings-scenario-banner"
            title={scenario === 'empty' ? 'Demo scenario: empty data' : 'Demo scenario: network error'}
            variant={scenario === 'error' ? 'destructive' : 'warning'}
          />
        ) : null}

        <Card className="gap-5" variant="raised">
          <Section description="Applies immediately across every screen." title="Theme">
            <SegmentedControl onValueChange={(value) => setTheme(value as ThemePreference)} value={theme}>
              {THEME_OPTIONS.map((option) => (
                <SegmentedControlItem key={option.value} value={option.value}>
                  {option.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </Section>

          <Separator />

          <Section description="Row height and spacing on lists and tables." title="Density">
            <SegmentedControl onValueChange={(value) => setDensity(value as typeof density)} value={density}>
              {DENSITY_OPTIONS.map((option) => (
                <SegmentedControlItem key={option.value} value={option.value}>
                  {option.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </Section>

          <Separator />

          <Section
            description={
              Platform.OS === 'web'
                ? 'Applies immediately on Web.'
                : 'Native requires an app restart to fully re-mirror the layout.'
            }
            title="Direction"
          >
            <SegmentedControl
              onValueChange={(value) => handleDirectionChange(value as DirectionPreference)}
              value={direction}
            >
              {DIRECTION_OPTIONS.map((option) => (
                <SegmentedControlItem key={option.value} value={option.value}>
                  {option.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </Section>

          <Separator />

          <Section
            description={
              Platform.OS === 'web'
                ? 'Scales the app root font size.'
                : 'Tracked for display; native Dynamic Type is an OS-level setting BeeUI already respects.'
            }
            title="Text size"
          >
            <SegmentedControl onValueChange={(value) => setTextScale(value as TextScalePreference)} value={textScale}>
              {TEXT_SCALE_OPTIONS.map((option) => (
                <SegmentedControlItem key={option.value} value={option.value}>
                  {option.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </Section>

          <Separator />

          <Section
            description="Switches loading/empty/error outcomes across the dashboard, records, and schedule screens."
            title="Demo data scenario"
          >
            <SegmentedControl onValueChange={(value) => setScenario(value as DemoScenario)} value={scenario}>
              {DEMO_SCENARIO_OPTIONS.map((option) => (
                <SegmentedControlItem key={option.value} value={option.value}>
                  {option.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </Section>
        </Card>

        <ListGroup>
          <ListGroupHeader title="Accessibility" />
          <SettingsItem
            description="Read from the OS/browser — not a BeeUI setting."
            title="Reduced motion"
            value={reducedMotion ? 'On' : 'Off'}
          />
        </ListGroup>

        <ListGroup testID="settings-quick-links">
          <ListGroupHeader title="Jump to a flow" />
          <ListItem onPress={() => router.push('/')} title="Dashboard" />
          <ListItem onPress={() => router.push('/records')} title="Tickets" />
          <ListItem onPress={() => router.push('/schedule')} title="Schedule" />
        </ListGroup>
      </VStack>
    </KeyboardAwareScreen>
  );
}
