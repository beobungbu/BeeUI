import { collectPublicComponentPreviewViolations } from '../public-component-previews.mjs';

export function collectViolations(rootDir) {
  return collectPublicComponentPreviewViolations(rootDir);
}
