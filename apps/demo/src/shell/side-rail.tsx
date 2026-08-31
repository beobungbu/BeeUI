import { Box, VStack } from '@beeui/ui';
import { usePathname } from 'expo-router';
import * as React from 'react';
import { NavItem } from './nav-item';
import { isNavRouteActive, NAV_ROUTES } from './nav-routes';

/**
 * Medium/expanded-layout chrome (ADR-013 D3): a persistent side navigation
 * rail replacing the compact bottom tab bar once the viewport reaches the
 * `medium` breakpoint. Brand/title lives in the shared `AppHeader` above this
 * rail (`app-shell.tsx`), not duplicated here.
 */
export function SideRail() {
  const pathname = usePathname();

  return (
    <Box
      accessibilityRole="tablist"
      className="w-64 shrink-0 gap-2 border-r border-border bg-surface px-3 py-4"
    >
      <VStack gap="xs">
        {NAV_ROUTES.map((route) => (
          <NavItem
            key={route.path}
            orientation="column"
            route={route}
            selected={isNavRouteActive(route, pathname)}
          />
        ))}
      </VStack>
    </Box>
  );
}
