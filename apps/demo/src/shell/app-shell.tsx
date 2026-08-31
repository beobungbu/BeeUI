import { AppHeader, Box, SafeArea, Screen } from '@beemvp/beeui-ui';
import { Slot, usePathname } from 'expo-router';
import * as React from 'react';
import { BottomTabBar } from './bottom-tab-bar';
import { isNavRouteActive, NAV_ROUTES } from './nav-routes';
import { useShellLayoutClass } from './responsive-nav';
import { SideRail } from './side-rail';

/**
 * The responsive navigation shell (ADR-013 D3), composed once here and
 * mounted by `app/(tabs)/_layout.tsx`. It is the single owner of safe-area
 * insets for the whole app (`docs/responsive-layout.md`'s safe-area
 * ownership model: each system edge assigned to exactly one shell element) —
 * screens rendered through `Slot` never re-apply `top`/`bottom` insets
 * themselves.
 */
export function AppShell() {
  const layoutClass = useShellLayoutClass();
  const pathname = usePathname();
  const isRailLayout = layoutClass !== 'compact';
  const activeRoute = NAV_ROUTES.find((route) => isNavRouteActive(route, pathname));

  return (
    <Screen>
      <SafeArea className="flex-1 bg-background" edges={['top', 'left', 'right', 'bottom']}>
        <AppHeader description="BeeUI production reference application" title={activeRoute?.label ?? 'BeeUI Demo'} />
        {isRailLayout ? (
          <Box className="flex-1 flex-row">
            <SideRail />
            <Box className="mx-auto w-full max-w-page flex-1">
              <Slot />
            </Box>
          </Box>
        ) : (
          <>
            <Box className="flex-1">
              <Slot />
            </Box>
            <BottomTabBar />
          </>
        )}
      </SafeArea>
    </Screen>
  );
}
