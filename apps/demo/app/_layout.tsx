import '../global.css';

import { BeeUIProvider } from '@beemvp/beeui-ui';
import { Stack } from 'expo-router';
import * as React from 'react';
import { AppProviders } from '../src/providers/app-providers';
import { DemoScenarioProvider } from '../src/state/demo-scenario';
import { AppPreferencesProvider, useAppPreferences } from '../src/state/preferences';

/**
 * Keys the router's `Stack` on the active direction preference so a Web
 * runtime `dir` change (ADR-004 "Change expectations on Web") gets the one
 * explicit re-render of the affected subtree BeeUI's ambient direction
 * resolver requires — see `src/state/preferences.tsx`'s `setDirection`.
 */
function DirectionKeyedNavigator() {
  const { direction } = useAppPreferences();

  return (
    <Stack key={direction} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <BeeUIProvider>
      <AppProviders>
        <AppPreferencesProvider>
          <DemoScenarioProvider>
            <DirectionKeyedNavigator />
          </DemoScenarioProvider>
        </AppPreferencesProvider>
      </AppProviders>
    </BeeUIProvider>
  );
}
