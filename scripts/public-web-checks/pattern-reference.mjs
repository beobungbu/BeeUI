import { collectPublicPatternViolations } from '../public-pattern-reference.mjs';

export function collectViolations(rootDir) {
  return collectPublicPatternViolations(rootDir);
}
