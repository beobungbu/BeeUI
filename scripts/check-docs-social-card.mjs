#!/usr/bin/env node

// Social-card gate for the documentation portal.
//
//   node scripts/check-docs-social-card.mjs                 # report
//   node scripts/check-docs-social-card.mjs --check         # fail if any built page breaks the contract
//   node scripts/check-docs-social-card.mjs --dist=<dir>    # check another built copy of the portal
//
// `--dist` exists so the test suite can drive a real breach through this entrypoint end to end.
// A crash-only spawn test cannot tell a crash-1 from a verdict-1, and the verdict is the part
// that has to reach the process.
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
export const DOCS_CONFIG_PATH = 'apps/docs/astro.config.mjs';

/**
 * Asserts the social-card contract on the built portal.
 *
 * `distDir` and `configPath` are overridable so a caller can point the same rules at another
 * built copy or another portal config without editing the committed ones. The CLI exposes only
 * `--dist`; `configPath` exists so the tagline-drift rule below is reachable from a test, which
 * is the difference between a rule that works and a rule that is known to work.
 *
 * @param {string} [rootDir]
 * @param {{configPath?: string, distDir?: string}} [overrides]
 * @returns {string[]}
 */
export function collectDocsSocialCardViolations(rootDir = ROOT_DIR, { configPath, distDir } = {}) {
  const builtDir = distDir ?? path.join(rootDir, DOCS_DIST_DIR);
  // The default output is named the way a reader would run it; anything else is named in full,
  // because a violation attributed to `apps/docs/dist` that came from somewhere else is a lie.
  const builtLabel = distDir ? builtDir : DOCS_DIST_DIR;
  const pages = htmlFilesIn(builtDir);
  if (!pages.length) return [`${builtLabel} has no built pages. Run the docs build first.`];

  const contract = buildPublicSiteContract(rootDir);
  const violations = collectDistSocialCardViolations({
    distDir: builtDir,
    routePrefix: contract.docsBase,
    // The origin is read from each page's own canonical link rather than from the contract, so
    // the check does not fail merely because the build and the check ran under different
    // BEEUI_WEB_ENV values. Absoluteness and same-origin are still enforced per page.
    label: `${builtLabel}/`,
  });

  // The card's tagline is baked into a committed PNG, so it cannot follow the portal
  // description automatically. This fails when the two drift apart.
  const resolvedConfigPath = configPath ?? path.join(rootDir, DOCS_CONFIG_PATH);
  const config = fs.readFileSync(resolvedConfigPath, 'utf8');
  if (!config.toLowerCase().includes(SOCIAL_CARD.tagline.toLowerCase())) {
    violations.push(
      `${DOCS_CONFIG_PATH} no longer describes the portal as "${SOCIAL_CARD.tagline}", which is the text rendered into ${SOCIAL_CARD.sourcePath}. ` +
        'Update SOCIAL_CARD in scripts/social-card-lib.mjs and run: pnpm docs:og-image',
    );
  }
  return violations;
}

export function reportDocsSocialCard(rootDir = ROOT_DIR, { distDir } = {}) {
  const files = htmlFilesIn(distDir ?? path.join(rootDir, DOCS_DIST_DIR));
  let withCard = 0;
  let large = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (metaContent(html, 'og:image')) withCard += 1;
    if (metaContent(html, 'twitter:card') === 'summary_large_image') large += 1;
  }
  return { pages: files.length, withCard, large };
}

/** Every argument this command accepts. A typo must not be read as "report, do not check". */
export const KNOWN_ARGUMENTS = Object.freeze(['--check', '--dist=<path>']);

/**
 * Reads the command line.
 *
 * Anything unrecognised throws instead of being ignored: `--chek` or `--check=1` silently
 * reporting and exiting 0 is the one failure mode a gate must not have.
 *
 * @param {string[]} argv
 * @returns {{check: boolean, distDir: string | undefined}}
 */
export function parseArguments(argv) {
  let check = false;
  let distDir;
  for (const argument of argv) {
    if (argument === '--check') {
      check = true;
      continue;
    }
    if (argument.startsWith('--dist=')) {
      const value = argument.slice('--dist='.length).trim();
      if (!value) throw new Error('--dist needs a path: --dist=<path>.');
      distDir = path.resolve(value);
      continue;
    }
    throw new Error(`unknown argument: ${argument}. This command accepts ${KNOWN_ARGUMENTS.join(', ')}.`);
  }
  return { check, distDir };
}

/**
 * The whole command: collect violations, report, and decide the exit code.
 *
 * Returns the code rather than assigning `process.exitCode`, so the decision that can silently
 * stop failing is a value a test can read.
 *
 * @param {{argv?: string[], rootDir?: string, log?: (line: string) => void, logError?: (line: string) => void}} [options]
 * @returns {number} 0 when passing or when not asked to check, 1 on a breach
 */
export function run({ argv = [], rootDir = ROOT_DIR, log = console.log, logError = console.error } = {}) {
  const { check, distDir } = parseArguments(argv);
  const violations = collectDocsSocialCardViolations(rootDir, { distDir });
  const { pages, withCard, large } = reportDocsSocialCard(rootDir, { distDir });
  // A run against another build must say so, or its verdict reads as the portal's own.
  if (distDir) log(`Checked ${distDir} (not the built portal).`);

  if (!check) {
    log(`${distDir ?? DOCS_DIST_DIR}: ${pages} pages, ${withCard} with og:image, ${large} with twitter:card=summary_large_image.`);
    for (const violation of violations) log(`- ${violation}`);
    return 0;
  }

  if (violations.length) {
    logError('Docs social-card gate failed:');
    for (const violation of violations) logError(`- ${violation}`);
    return 1;
  }
  log(`Docs social-card gate passed: ${withCard}/${pages} pages carry og:image, ${large} declare summary_large_image.`);
  return 0;
}

/**
 * Turns both outcomes of a command run — a verdict and a crash — into an exit code.
 *
 * Exported because this mapping is the part that can silently stop failing: an entrypoint that
 * discards what `run` returned still prints every violation and still exits 0, which is how a
 * shipped gate switches itself off. The assignment below only delivers this value to the process.
 *
 * @param {string[]} argv
 * @param {{execute?: typeof run, logError?: (line: string) => void}} [options]
 * @returns {number}
 */
export function main(argv, { execute = run, logError = console.error } = {}) {
  try {
    return execute({ argv });
  } catch (error) {
    logError(error.message ?? error);
    return 1;
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  process.exitCode = main(process.argv.slice(2));
}
