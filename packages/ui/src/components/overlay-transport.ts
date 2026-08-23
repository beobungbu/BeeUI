import { createLegacyStoreTransport, type OverlayTransport } from './overlay-transport-shared';

export * from './overlay-transport-shared';

/**
 * Default resolution used for type-checking and any environment without a
 * platform-specific transport file. Metro resolves `overlay-transport.native`
 * (teleport) and `overlay-transport.web` (react-dom) ahead of this module; the
 * defensive legacy transport is the safe default everywhere else.
 */
export function resolveOverlayTransport(): OverlayTransport {
  return createLegacyStoreTransport();
}
