import { Text } from '@beemvp/beeui-ui';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Pressable } from 'react-native';
import type { NavRoute } from './nav-routes';

export type NavItemOrientation = 'row' | 'column';

export type NavItemProps = {
  /**
   * `'row'` for the compact bottom tab bar (icon/label stacked, items laid
   * out side by side); `'column'` for the medium/expanded side rail (items
   * stacked, label beside the marker). Purely a layout affordance — both
   * orientations expose the same `role="tab"` + selected-state contract.
   */
  orientation: NavItemOrientation;
  route: NavRoute;
  selected: boolean;
};

/**
 * One navigation destination, shared by the compact bottom tab bar and the
 * medium/expanded side rail (ADR-013 D3). Built directly on `Pressable`
 * rather than BeeUI's `Link` component: `Link` hardcodes
 * `accessibilityRole="link"`, but a navigation destination that is one of a
 * mutually-exclusive set of app sections is a `"tab"` for assistive
 * technology (ADR-013 D3's "Tab/rail items expose accessible names and
 * selected state") — app-owned navigation chrome, not a BeeUI primitive.
 */
export function NavItem({ orientation, route, selected }: NavItemProps) {
  const router = useRouter();
  const containerClassName =
    orientation === 'row'
      ? 'flex-1 items-center justify-center gap-1 rounded-md px-2 py-2 active:opacity-70'
      : 'w-full flex-row items-center gap-3 rounded-md px-3 py-3 active:opacity-70';

  return (
    <Pressable
      accessibilityLabel={route.label}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      className={`${containerClassName} ${selected ? 'bg-accent' : ''}`}
      onPress={() => router.navigate(route.path)}
    >
      <Text tone={selected ? 'default' : 'muted'} variant="label">
        {route.label}
      </Text>
    </Pressable>
  );
}
