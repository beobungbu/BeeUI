#!/usr/bin/env node

// Renders the shared social card to `apps/docs/public/og-beeui.png`.
//
//   node scripts/generate-og-image.mjs           # regenerate the PNG (needs Playwright Chromium)
//   node scripts/generate-og-image.mjs --check    # verify the committed PNG, no browser needed
//
// The card is a committed binary because nothing in the runtime dependency tree can rasterise an
// SVG, and because an Open Graph consumer will not render SVG anyway. It is not an opaque blob:
// the artwork is `renderSocialCardSvg()` in scripts/social-card-lib.mjs, derived from the dark
// theme colours in packages/tokens/tokens.json, and this script re-renders it on demand through
// the Chromium that apps/visual-regression already installs. Text is laid out by the browser
// with a system font stack, so a regenerated PNG is not byte-identical across machines — which
// is exactly why the output is committed rather than built in CI. `--check` therefore asserts
// the properties that matter to a crawler (real PNG, 1200x630, under the size ceiling) instead
// of comparing bytes against a re-render.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR } from './public-site-contract-lib.mjs';
import { SOCIAL_CARD, collectCardFileViolations, renderSocialCardSvg } from './social-card-lib.mjs';

function loadChromium(rootDir) {
  // Playwright is a devDependency of apps/visual-regression, not of the workspace root, and pnpm
  // does not hoist it. Resolving from that package keeps one Chromium install for the repo.
  const require = createRequire(path.join(rootDir, 'apps/visual-regression/package.json'));
  try {
    return require('@playwright/test').chromium;
  } catch (error) {
    throw new Error(
      'Cannot load Playwright Chromium from apps/visual-regression. ' +
        'Run `pnpm install` and `pnpm --filter @beemvp/beeui-visual-regression exec playwright install chromium`, then retry.\n' +
        `Underlying error: ${error.message}`,
    );
  }
}

export async function generateSocialCard(rootDir = ROOT_DIR) {
  const svg = renderSocialCardSvg(rootDir);
  const chromium = loadChromium(rootDir);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: SOCIAL_CARD.width, height: SOCIAL_CARD.height },
      deviceScaleFactor: 1,
    });
    await page.setContent(`<!doctype html><html><body style="margin:0;padding:0">${svg}</body></html>`, { waitUntil: 'load' });
    const buffer = await page.screenshot({ type: 'png' });
    const target = path.join(rootDir, SOCIAL_CARD.sourcePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer);
    return { bytes: buffer.length, target };
  } finally {
    await browser.close();
  }
}

export function collectSocialCardAssetViolations(rootDir = ROOT_DIR) {
  return collectCardFileViolations(path.join(rootDir, SOCIAL_CARD.sourcePath), SOCIAL_CARD.sourcePath);
}

/**
 * The whole command: regenerate the card, or verify the committed one.
 *
 * Returns the exit code instead of assigning `process.exitCode`, so the verdict is a value a
 * test can read. `--check` is wired into `pnpm -w typecheck` through `docs:social-card:asset-check`.
 *
 * @param {{argv?: string[], rootDir?: string, generate?: typeof generateSocialCard, log?: (line: string) => void, logError?: (line: string) => void}} [options]
 * @returns {Promise<number>}
 */
export async function run({
  argv = [],
  rootDir = ROOT_DIR,
  generate = generateSocialCard,
  log = console.log,
  logError = console.error,
} = {}) {
  const unsupported = argv.find((argument) => argument !== '--check');
  if (unsupported) throw new Error(`unknown argument: ${unsupported}. This command accepts --check.`);

  if (argv.includes('--check')) {
    const violations = collectSocialCardAssetViolations(rootDir);
    if (violations.length) {
      logError('Social card asset check failed:');
      for (const violation of violations) logError(`- ${violation}`);
      return 1;
    }
    const bytes = fs.statSync(path.join(rootDir, SOCIAL_CARD.sourcePath)).size;
    log(`Social card is a ${SOCIAL_CARD.width}x${SOCIAL_CARD.height} PNG (${(bytes / 1024).toFixed(1)} KB).`);
    return 0;
  }

  const { bytes, target } = await generate(rootDir);
  log(`Wrote ${path.relative(rootDir, target)} (${(bytes / 1024).toFixed(1)} KB).`);
  return 0;
}

/**
 * Turns both outcomes of a command run — a verdict and a crash — into an exit code.
 *
 * Exported because this mapping is the part that can silently stop failing: an entrypoint that
 * discards what `run` returned still prints every violation and still exits 0. The assignment
 * below only delivers this value to the process.
 *
 * @param {string[]} argv
 * @param {{execute?: typeof run, logError?: (line: string) => void}} [options]
 * @returns {Promise<number>}
 */
export async function main(argv, { execute = run, logError = console.error } = {}) {
  return execute({ argv }).catch((error) => {
    logError(error.message ?? error);
    return 1;
  });
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  process.exitCode = await main(process.argv.slice(2));
}
