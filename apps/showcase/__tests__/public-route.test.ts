import { normalizePatternRoute, parsePublicShowcaseSearch } from '../public-route-core';

describe('public Showcase route contract', () => {
  test('parses component/embed links without changing native navigation architecture', () => {
    expect(parsePublicShowcaseSearch('?component=dialog&embed=1')).toEqual({
      component: 'dialog',
      embed: true,
      pattern: undefined,
      section: undefined,
    });
  });

  test('normalizes source filename pattern slugs to Pattern Gallery runtime ids', () => {
    expect(normalizePatternRoute('auth/sign-in-screen')).toBe('auth/sign-in');
    expect(parsePublicShowcaseSearch('?pattern=auth%2Fsign-in-screen&embed=1').pattern).toBe('auth/sign-in');
  });

  test('accepts only intentional public section shortcuts', () => {
    expect(parsePublicShowcaseSearch('?section=patterns').section).toBe('patterns');
    expect(parsePublicShowcaseSearch('?section=runtime').section).toBeUndefined();
  });
});
