import { parseShowcaseTarget, serializeShowcaseTarget, type ShowcaseTarget } from './showcase-target';

export function readShowcaseTargetFromLocation(): ShowcaseTarget | null {
  if (typeof window === 'undefined') return null;
  return parseShowcaseTarget(window.location.search);
}

export function writeShowcaseTargetToLocation(target: ShowcaseTarget | null, mode: 'push' | 'replace' = 'push') {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.search = target ? serializeShowcaseTarget(target) : '';
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (mode === 'replace') window.history.replaceState(null, '', next);
  else window.history.pushState(null, '', next);
}

export function subscribeToShowcaseHistory(listener: (target: ShowcaseTarget | null) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handlePopState = () => listener(readShowcaseTargetFromLocation());
  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}
