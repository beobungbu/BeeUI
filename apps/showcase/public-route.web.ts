import { parsePublicShowcaseSearch } from './public-route-core';

export function getPublicShowcaseRoute() {
  const location = (globalThis as unknown as { location?: { search?: string } }).location;
  return parsePublicShowcaseSearch(location?.search ?? '');
}

export function navigatePublicPath(path: string) {
  const location = (globalThis as unknown as { location?: { assign?: (next: string) => void } }).location;
  location?.assign?.(path);
}
