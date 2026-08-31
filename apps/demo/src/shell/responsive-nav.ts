import { breakpoint } from '@beemvp/beeui-tokens';
import { useWindowDimensions } from 'react-native';

/**
 * The three semantic layout classes from `docs/responsive-layout.md`: compact
 * (base, bottom tab bar), `medium`/`expanded` (persistent side rail, wider
 * content container). This is the one documented native width-switch pattern
 * (ADR-013 D3, mirroring the Pattern Gallery's single `width >= 960` switch) —
 * `useWindowDimensions()` is read on every platform (it is also how
 * react-native-web reports live browser width) rather than inventing a
 * separate Tailwind-vs-native branch for this *structural* decision. Purely
 * cosmetic width-driven styling elsewhere should still prefer Tailwind's
 * `md:`/`xl:` variants on Web per the same doc; this hook is reserved for the
 * one structural choice (which navigation chrome subtree renders) that
 * Tailwind classes cannot express.
 */
export type ShellLayoutClass = 'compact' | 'medium' | 'expanded';

export function resolveShellLayoutClass(width: number): ShellLayoutClass {
  if (width >= breakpoint.expanded) return 'expanded';
  if (width >= breakpoint.medium) return 'medium';
  return 'compact';
}

export function useShellLayoutClass(): ShellLayoutClass {
  const { width } = useWindowDimensions();
  return resolveShellLayoutClass(width);
}
