import { breakpoint } from '@beeui/tokens';
import { resolveShellLayoutClass } from '../src/shell/responsive-nav';

describe('resolveShellLayoutClass', () => {
  it('classifies below the medium breakpoint as compact', () => {
    expect(resolveShellLayoutClass(360)).toBe('compact');
    expect(resolveShellLayoutClass(breakpoint.medium - 1)).toBe('compact');
  });

  it('classifies at/above medium but below expanded as medium', () => {
    expect(resolveShellLayoutClass(breakpoint.medium)).toBe('medium');
    expect(resolveShellLayoutClass(breakpoint.expanded - 1)).toBe('medium');
  });

  it('classifies at/above the expanded breakpoint as expanded', () => {
    expect(resolveShellLayoutClass(breakpoint.expanded)).toBe('expanded');
    expect(resolveShellLayoutClass(1920)).toBe('expanded');
  });
});
