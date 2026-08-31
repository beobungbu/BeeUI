import { isNavRouteActive, NAV_ROUTES } from '../src/shell/nav-routes';

describe('isNavRouteActive', () => {
  const dashboard = NAV_ROUTES[0]!;
  const records = NAV_ROUTES[1]!;

  it('matches the dashboard route only at the exact root path', () => {
    expect(isNavRouteActive(dashboard, '/')).toBe(true);
    expect(isNavRouteActive(dashboard, '/records')).toBe(false);
  });

  it('matches a non-root route at its own path', () => {
    expect(isNavRouteActive(records, '/records')).toBe(true);
  });

  it('matches a non-root route when nested under it', () => {
    expect(isNavRouteActive(records, '/records/42')).toBe(true);
  });

  it('does not match an unrelated path that merely shares a prefix', () => {
    expect(isNavRouteActive(records, '/records-archive')).toBe(false);
  });
});
