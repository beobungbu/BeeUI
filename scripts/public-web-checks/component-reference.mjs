import { collectPublicComponentReferenceViolations } from '../public-component-reference.mjs';

export function collectViolations(rootDir) {
  return collectPublicComponentReferenceViolations(rootDir);
}
