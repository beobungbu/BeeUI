/**
 * The demo's four top-level destinations (ADR-013 D5). Route paths are
 * relative to the `(tabs)` group root, so `'/'` resolves to
 * `app/(tabs)/index.tsx`. Adding a fifth destination is additive — append a
 * `NavRoute` entry here and add its matching `app/(tabs)/<segment>` route;
 * no other shell file needs to change.
 */
export type NavRoute = {
  /** Accessible name surfaced as the tab/rail item's label and a11y name. */
  label: string;
  /** Path matched against the router's current pathname to derive `selected`. */
  path: string;
};

export const NAV_ROUTES: readonly NavRoute[] = [
  { label: 'Dashboard', path: '/' },
  { label: 'Records', path: '/records' },
  { label: 'Schedule', path: '/schedule' },
  { label: 'Settings', path: '/settings' },
];

/** `true` when `pathname` is the route itself or nested under it (e.g. `/records/42`). */
export function isNavRouteActive(route: NavRoute, pathname: string): boolean {
  if (route.path === '/') return pathname === '/';
  return pathname === route.path || pathname.startsWith(`${route.path}/`);
}
