import { BottomActionBar } from '@beemvp/beeui-ui';
import { usePathname } from 'expo-router';
import * as React from 'react';
import { NavItem } from './nav-item';
import { isNavRouteActive, NAV_ROUTES } from './nav-routes';

/**
 * Compact-layout chrome (ADR-013 D3): a bottom tab bar built on BeeUI's
 * `BottomActionBar` container, overriding its default `justify-end` (built
 * for form save/cancel actions) so the four destinations distribute evenly.
 */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <BottomActionBar accessibilityRole="tablist" className="justify-between gap-1">
      {NAV_ROUTES.map((route) => (
        <NavItem
          key={route.path}
          orientation="row"
          route={route}
          selected={isNavRouteActive(route, pathname)}
        />
      ))}
    </BottomActionBar>
  );
}
