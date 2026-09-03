import fs from 'node:fs';
import path from 'node:path';

import { readPublicGuideData } from '../public-guide-data.mjs';

const REQUIRED = [
  'apps/docs/src/content/docs/theming/index.md',
  'apps/docs/src/content/docs/responsive.md',
  'apps/docs/src/content/docs/accessibility/index.md',
  'apps/docs/src/content/docs/accessibility/keyboard-focus.md',
  'apps/docs/src/content/docs/accessibility/reduced-motion.md',
  'apps/docs/src/content/docs/accessibility/native-assistive-tech.md',
  'apps/docs/src/content/docs/compatibility/index.md',
  'apps/docs/src/content/docs/migration/index.md',
  'apps/docs/src/content/docs/troubleshooting/index.md',
  'apps/docs/src/content/docs/performance/index.md',
  'apps/docs/src/content/docs/release-security/index.md',
  'apps/docs/src/content/docs/architecture.md',
];

export function collectViolations(rootDir) {
  const violations = [];
  const data = readPublicGuideData(rootDir);
  const root = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  if (data.version !== root.version) violations.push('public guide version source does not match root manifest.');
  if (data.distribution.currentVersion !== root.version) violations.push('dist-tag currentVersion does not match public guide version.');
  if (data.distribution.published !== false) violations.push('guide corpus launch contract expected unpublished distribution state.');

  for (const file of REQUIRED) {
    const full = path.join(rootDir, file);
    if (!fs.existsSync(full)) { violations.push(`${file}: required public guide is missing.`); continue; }
    const text = fs.readFileSync(full, 'utf8');
    if (/content pending|tracked for a follow-up|intentionally a stub/i.test(text)) violations.push(`${file}: launch guide still contains stub language.`);
    if (!text.includes('github.com/beobungbu/BeeUI')) violations.push(`${file}: guide lacks a canonical source link.`);
  }
  return violations;
}
