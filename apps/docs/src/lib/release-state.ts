import releaseStateData from '../../public/release-state.json';

import type { ReleaseState } from './foundation-contract';

/**
 * Canonical user-facing release truth for the docs portal.
 *
 * `apps/docs` predev/prebuild/pretypecheck generates the JSON from the repository's
 * machine-readable dist-tag policy and package manifests. Do not hand-edit the generated
 * JSON or duplicate publication booleans in UI code.
 */
export const RELEASE_STATE = releaseStateData as ReleaseState;

export function canShowPublicInstallCta(state: ReleaseState = RELEASE_STATE): boolean {
  return state.published && state.publicInstallCommandsAvailable && state.installCta !== 'hidden';
}
