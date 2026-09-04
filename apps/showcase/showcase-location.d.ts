import type { ShowcaseTarget } from './showcase-target';

export function readShowcaseTargetFromLocation(): ShowcaseTarget | null;
export function writeShowcaseTargetToLocation(target: ShowcaseTarget | null, mode?: 'push' | 'replace'): void;
export function subscribeToShowcaseHistory(listener: (target: ShowcaseTarget | null) => void): () => void;
