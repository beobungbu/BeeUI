#!/usr/bin/env node

// Social-card gate for the documentation portal.
//
//   node scripts/check-docs-social-card.mjs           # report
//   node scripts/check-docs-social-card.mjs --check    # fail if any built page breaks the contract
//
// Every portal page declares `twitter:card=summary_large_image`. This asserts that every one of
// them also carries an `og:image` that is an absolute URL on the page's own origin, that the
// dimensions it advertises match the file, and that the file is actually in `apps/docs/dist` —
// so a card cannot be promised in metadata and missing from the deploy.
//
// ENFORCEMENT: this runs from `apps/docs`'s build script, because it needs apps/docs/dist, the
// same way scripts/check-docs-page-budget.mjs does. `scripts/ci-scope.mjs` selects the visual
// lane (the only job that builds the portal) for this script, for the head component that emits
// the tags, and for the committed card, so a change that could break this check also starts the
// job that runs it. `scripts/public-web-checks/seo.mjs` applies the same contract to the landing
// output, which is built by `pnpm web:check` itself.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR, buildPublicSiteContract } from './public-site-contract-lib.mjs';
import { SOCIAL_CARD, collectDistSocialCardViolations, htmlFilesIn, metaContent } from './social-card-lib.mjs';

export const DOCS_DIST_DIR = 'apps/docs/dist';
const DOCS_CONFIG_PATH = 'apps/docs/astro.config.mjs';

export function collectDocsSocialCardViolations(rootDir = ROOT_DIR) {
  const distDir = path.join(rootDir, DOCS_DIST_DIR);
  const pages = htmlFilesIn(distDir);
  if (!pages.length) return [`${DOCS_DIST_DIR} has no built pages. Run the docs build first.`];

  const contract = buildPublicSiteContract(rootDir);
  const violations = collectDistSocialCardViolations({
    distDir,
    routePrefix: contract.docsBase,
    // The origin is read from each page's own canonical link rather than from the contract, so
    // the check does not fail merely because the build and the check ran under different
    // BEEUI_WEB_ENV values. Absoluteness and same-origin are still enforced per page.
    label: `${DOCS_DIST_DIR}/`,
  });

  // The card's tagline is baked into a committed PNG, so it cannot follow the portal
  // description automatically. This fails when the two drift apart.
  const config = fs.readFileSync(path.join(rootDir, DOCS_CONFIG_PATH), 'utf8');
  if (!config.toLowerCase().includes(SOCIAL_CARD.tagline.toLowerCase())) {
    violations.push(
      `${DOCS_CONFIG_PATH} no longer describes the portal as "${SOCIAL_CARD.tagline}", which is the text rendered into ${SOCIAL_CARD.sourcePath}. ` +
        'Update SOCIAL_CARD in scripts/social-card-lib.mjs and run: pnpm docs:og-image',
    );
  }
  return violations;
}

export function reportDocsSocialCard(rootDir = ROOT_DIR) {
  const distDir = path.join(rootDir, DOCS_DIST_DIR);
  const files = htmlFilesIn(distDir);
  let withCard = 0;
  let large = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (metaContent(html, 'og:image')) withCard += 1;
    if (metaContent(html, 'twitter:card') === 'summary_large_image') large += 1;
  }
  return { pages: files.length, withCard, large };
}

function main() {
  const args = process.argv.slice(2);
  const unsupported = args.find((arg) => arg !== '--check');
  if (unsupported) {
    console.error(`Unsupported argument: ${unsupported}`);
    process.exitCode = 1;
    return;
  }

  const violations = collectDocsSocialCardViolations();
  if (args.includes('--check')) {
    if (violations.length) {
      console.error('Docs social-card gate failed:');
      for (const violation of violations) console.error(`- ${violation}`);
      process.exitCode = 1;
      return;
    }
    const { pages, withCard, large } = reportDocsSocialCard();
    console.log(`Docs social-card gate passed: ${withCard}/${pages} pages carry og:image, ${large} declare summary_large_image.`);
    return;
  }

  const { pages, withCard, large } = reportDocsSocialCard();
  console.log(`${DOCS_DIST_DIR}: ${pages} pages, ${withCard} with og:image, ${large} with twitter:card=summary_large_image.`);
  for (const violation of violations) console.log(`- ${violation}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    main();
  } catch (error) {
    console.error(error.message ?? error);
    process.exitCode = 1;
  }
}
