import './global.css';

import {
  BeeUIProvider,
  Box,
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
  SafeArea,
  Screen,
  Text,
  VStack,
} from '@beeui/ui';
import * as React from 'react';

/**
 * #35 spike — reproduce anchored-overlay portal context loss.
 *
 * A consumer context is declared between BeeUIProvider and the Popover. A probe
 * component reads it in two places:
 *   - Outside the overlay: always resolves the provided value.
 *   - Inside PopoverContent: renders under the root OverlayPortal host, so its
 *     React ancestry is the host, not the declaration site.
 *
 * Baseline expectation (current code, native): inside probe shows "LOST".
 * On web it already shows the provided value because react-dom createPortal
 * preserves context — the spike must therefore be judged on a native simulator.
 */

const SPIKE_DEFAULT = 'LOST (context default)';
const SPIKE_PROVIDED = 'PRESERVED (provider value)';

const SpikeContext = React.createContext(SPIKE_DEFAULT);

function ContextProbe({ label, testID }: { label: string; testID: string }) {
  const value = React.useContext(SpikeContext);
  const preserved = value === SPIKE_PROVIDED;
  return (
    <Text testID={testID} tone={preserved ? 'success' : 'destructive'}>
      {`${label}: ${value}`}
    </Text>
  );
}

export default function SpikeApp() {
  return (
    <BeeUIProvider>
      <SpikeContext.Provider value={SPIKE_PROVIDED}>
        <Screen>
          <SafeArea className="flex-1 bg-surface" edges={['top', 'left', 'right', 'bottom']}>
            <VStack className="p-6" gap="lg">
              <Text variant="heading">#35 portal context spike</Text>

              {/* Control: same context, read outside the overlay. Always preserved. */}
              <ContextProbe label="outside overlay" testID="spike-outside" />

              <Box className="items-start">
                <Popover>
                  <PopoverTrigger>Open popover</PopoverTrigger>
                  <PopoverContent placement="bottom">
                    <PopoverTitle>Inside portalled content</PopoverTitle>
                    {/* Probe renders under the root OverlayPortal host. */}
                    <ContextProbe label="inside overlay" testID="spike-inside" />
                  </PopoverContent>
                </Popover>
              </Box>

              <Text tone="muted" variant="caption">
                outside = green (preserved). inside = red (lost) on native today; should turn green
                once the portal host preserves context. Geometry: popover must still anchor under
                the trigger.
              </Text>
            </VStack>
          </SafeArea>
        </Screen>
      </SpikeContext.Provider>
    </BeeUIProvider>
  );
}
