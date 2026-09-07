import fs from 'node:fs';
import path from 'node:path';

import { ROOT_DIR } from '../public-site-contract-lib.mjs';
import { renderPublicLanding } from '../build-public-landing.mjs';

const REQUIRED_SECTIONS = ['hero', 'platforms', 'components', 'patterns', 'demo', 'evidence', 'theming', 'ownership', 'ai', 'status'];
const REQUIRED_DESTINATIONS = ['/docs/start/', '/docs/components/', '/docs/patterns/', '/showcase/', '/demo/', '/llms.txt'];

export function collectViolations(rootDir = ROOT_DIR) {
  const violations = [];

  // #456: proof-point numbers must come from canonical generation. A literal count in the
  // template is correct only until the day it is not, and nothing would have said so — the
  // pattern count sat at a hand-typed 37 through every pattern the repo gained or lost.
  const template = fs.readFileSync(path.join(rootDir, 'web/site/index.template.html'), 'utf8');
  const proofStrip = /<section class="proof-strip"[\s\S]*?<\/section>/u.exec(template)?.[0] ?? '';
  for (const literal of proofStrip.matchAll(/<strong>(\d+)<\/strong>/gu)) {
    violations.push(
      `landing proof strip states a literal count ${literal[1]}; derive it from the canonical ` +
      'manifest through a template token instead.',
    );
  }

  const { html, contract, publicationLabel } = renderPublicLanding(rootDir);
  const css = fs.readFileSync(path.join(rootDir, 'web/site/site.css'), 'utf8');

  if (!html.includes('<html lang="en">')) violations.push('landing must declare its document language.');
  if (!html.includes('class="skip-link"')) violations.push('landing must provide a skip link.');
  if (!html.includes('<main id="main">')) violations.push('landing must expose the skip-link main target.');
  if (!html.includes(`v${contract.buildTruth.version}`)) violations.push('landing must render the canonical workspace version.');
  if (!html.includes(publicationLabel)) violations.push('landing must render canonical publication state.');
  if (contract.buildTruth.publication.published === false && !html.includes('Public npm/CLI publication is not open yet')) {
    violations.push('unpublished landing must state the package/CLI distribution boundary visibly.');
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!html.includes(`data-section="${section}"`)) violations.push(`landing is missing required section ${section}.`);
  }
  for (const href of REQUIRED_DESTINATIONS) {
    if (!html.includes(`href="${href}"`)) violations.push(`landing is missing required destination ${href}.`);
  }

  if (/\bnpm\s+(?:install|i)\s+@beemvp\/beeui-[a-z0-9-]+/i.test(html)) {
    violations.push('landing must not expose an unavailable npm package-install command.');
  }
  if (/\bnpx\s+@beemvp\/beeui-cli\b/i.test(html)) {
    violations.push('landing must not expose an unavailable public CLI command.');
  }
  if (/\{\{[A-Z0-9_]+\}\}/.test(html)) violations.push('landing has unresolved build placeholders.');

  if (!css.includes('@media (max-width: 620px)')) violations.push('landing must define compact-phone responsive behavior.');
  if (!css.includes('@media (prefers-reduced-motion: reduce)')) violations.push('landing must honor reduced motion.');
  if (!css.includes('@media (forced-colors: active)')) violations.push('landing must preserve forced-colors affordances.');
  if (!css.includes(':focus-visible')) violations.push('landing must provide visible keyboard focus.');

  return violations;
}
