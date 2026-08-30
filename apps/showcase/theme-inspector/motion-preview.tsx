import { motion, motionIntents, resolveMotion, type MotionIntent } from '@beeui/tokens';
import { resolveNativeMotion } from '@beeui/tokens/motion-runtime';
import { Badge, Box, Button, Card, HStack, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * Reads the platform reduced-motion signal. BeeUI adds no motion/preference store, so the
 * platform stays authoritative; this hook only mirrors it into React state.
 */
function usePlatformReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const query = AccessibilityInfo.isReduceMotionEnabled?.();
    if (query && typeof query.then === 'function') {
      query.then((value) => {
        if (active) setReduced(Boolean(value));
      });
    }
    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (value: boolean) => setReduced(Boolean(value)),
    );
    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}

const intentSummaries: Record<MotionIntent, { title: string; usage: string }> = {
  'overlay-enter': { title: 'Overlay enter', usage: 'Dialog, popover, dropdown, select, toast appearing' },
  'overlay-exit': { title: 'Overlay exit', usage: 'The same overlays dismissing' },
  'sheet-enter': { title: 'Sheet enter', usage: 'Sheet/BottomSheet panel appearing' },
  'sheet-exit': { title: 'Sheet exit', usage: 'Sheet/BottomSheet panel dismissing' },
  disclosure: { title: 'Disclosure', usage: 'Accordion / collapsible expand and collapse' },
};

function nativeSummary(intent: MotionIntent): string {
  const native = motion[intent].native;
  return native.type === 'spring'
    ? `spring · stiffness ${native.stiffness} · damping ${native.damping} · mass ${native.mass}`
    : `timing · ${native.durationMs}ms`;
}

type RepresentativeOverlayIntent = 'overlay-enter' | 'overlay-exit';

/**
 * Focused behavioral fixture for the motion contract. Rendering the fixture does not start
 * animation. Pressing the button explicitly requests a representative overlay transition,
 * exercises the resolved native spring/timing/immediate plan, and always returns to the
 * same final content state.
 */
export function MotionBehaviorFixture({
  intent = 'overlay-enter',
  reducedMotion = false,
}: {
  intent?: RepresentativeOverlayIntent;
  reducedMotion?: boolean;
}) {
  const progress = React.useRef(new Animated.Value(1)).current;
  const [phase, setPhase] = React.useState<'animating' | 'final'>('final');

  const play = React.useCallback(() => {
    const resolved = resolveMotion(intent, { reducedMotion });
    const nativePlan = resolveNativeMotion(intent, { reducedMotion });
    progress.setValue(0);

    const finish = () => {
      progress.setValue(1);
      setPhase('final');
    };

    if (!resolved.animate || nativePlan.type === 'immediate') {
      finish();
      return;
    }

    setPhase('animating');
    const animation = nativePlan.type === 'spring'
      ? Animated.spring(progress, {
          toValue: 1,
          stiffness: nativePlan.stiffness,
          damping: nativePlan.damping,
          mass: nativePlan.mass,
          useNativeDriver: true,
        })
      : Animated.timing(progress, {
          toValue: 1,
          duration: nativePlan.durationMs,
          easing: Easing.bezier(...nativePlan.easing),
          useNativeDriver: true,
        });

    animation.start(finish);
  }, [intent, progress, reducedMotion]);

  const resolved = resolveMotion(intent, { reducedMotion });
  const animatedStyle = {
    opacity: progress,
    ...(resolved.spatial
      ? {
          transform: [
            {
              scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }),
            },
          ],
        }
      : {}),
  };

  return (
    <Card className="gap-2" padding="md" variant="outlined">
      <Text variant="label">Representative behavior</Text>
      <Text tone="muted" variant="caption">
        Animation runs only after this behavior explicitly requests the {intent} intent.
      </Text>
      <Button onPress={play} size="sm" testID={`motion-behavior-play-${intent}`} variant="outline">
        Play {intent}
      </Button>
      <Animated.View style={animatedStyle} testID={`motion-behavior-surface-${intent}`}>
        <Box className="rounded-md border border-border bg-surface-muted p-3">
          <Text testID={`motion-behavior-final-${intent}`} variant="caption">
            Representative final state
          </Text>
        </Box>
      </Animated.View>
      <Text testID={`motion-behavior-phase-${intent}`} tone="muted" variant="caption">
        {phase}
      </Text>
    </Card>
  );
}

/**
 * A compact policy inspector plus one interaction-driven behavior fixture. The intent cards
 * stay in their final state so they do not animate merely because token metadata exists;
 * the behavioral fixture below runs only after an explicit press.
 */
export function MotionPreview({ reducedMotion }: { reducedMotion?: boolean }) {
  const platformReduced = usePlatformReducedMotion();
  const isReduced = reducedMotion ?? platformReduced;

  return (
    <VStack gap="sm">
      <HStack gap="sm">
        <Text variant="label">Reduced motion</Text>
        <Badge variant={isReduced ? 'warning' : 'outline'}>{isReduced ? 'On' : 'Off'}</Badge>
      </HStack>
      {motionIntents.map((intent) => {
        const resolved = resolveMotion(intent, { reducedMotion: isReduced });
        const summary = intentSummaries[intent];
        return (
          <Card key={intent} className="gap-2" padding="md" variant="outlined">
            <Text variant="label">{summary.title}</Text>
            <Text tone="muted" variant="caption">
              {summary.usage}
            </Text>
            <Box className="rounded-md border border-border bg-surface-muted p-3">
              <Text variant="caption">Final state is always shown here.</Text>
            </Box>
            <Text tone="muted" variant="caption">
              web {motion[intent].web.durationMs}ms · native {nativeSummary(intent)} · reduced-motion policy{' '}
              {motion[intent].reducedMotion}
            </Text>
            <Text tone="muted" variant="caption" testID={`motion-plan-${intent}`}>
              plan: {resolved.animate ? `animate ${resolved.durationMs}ms` : 'no animation (immediate)'} ·{' '}
              {resolved.spatial ? 'spatial' : 'no spatial motion'}
            </Text>
          </Card>
        );
      })}
      <MotionBehaviorFixture reducedMotion={isReduced} />
    </VStack>
  );
}
