import '../global.css';

import { BeeUIProvider, Box } from '@beemvp/beeui-ui';
import { Stack } from 'expo-router';
import * as React from 'react';
import { AppProviders } from '../src/providers/app-providers';
import { PublicSiteBar } from '../src/shell/public-site-bar';
import { DemoScenarioProvider } from '../src/state/demo-scenario';
import { AppPreferencesProvider, useAppPreferences } from '../src/state/preferences';

/**
 * Keys the router's `Stack` on the active direction preference so a Web
 * runtime `dir` change gets the one explicit re-render BeeUI's ambient
 * direction resolver requires.
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
            <Box className="flex-1">
              <PublicSiteBar />
              <Box className="flex-1">
                <DirectionKeyedNavigator />
              </Box>
            </Box>
          </DemoScenarioProvider>
        </AppPreferencesProvider>
      </AppProviders>
    </BeeUIProvider>
  );
}
