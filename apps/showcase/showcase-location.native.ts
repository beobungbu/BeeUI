import type { ShowcaseTarget } from './showcase-target';

export function readShowcaseTargetFromLocation(): ShowcaseTarget | null {
  return null;
}

export function writeShowcaseTargetToLocation(_target: ShowcaseTarget | null, _mode: 'push' | 'replace' = 'push') {
  // Native Showcase has no public browser URL. Selection remains local React state.
}

export function subscribeToShowcaseHistory(_listener: (target: ShowcaseTarget | null) => void) {
  return () => undefined;
}
