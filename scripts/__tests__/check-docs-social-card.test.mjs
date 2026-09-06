import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';

import { collectDocsSocialCardViolations, main, parseArguments, run } from '../check-docs-social-card.mjs';
import { collectSocialCardAssetViolations, main as generatorMain, run as generatorRun } from '../generate-og-image.mjs';
import {
  SOCIAL_CARD,
  collectCardFileViolations,
  collectDistSocialCardViolations,
  decodePngPixels,
  measureCardContent,
  metaContent,
  readPngSize,
  renderSocialCardSvg,
} from '../social-card-lib.mjs';

const rootDir = path.resolve(new URL('../..', import.meta.url).pathname);
const SCRIPT_FILE = path.join(rootDir, 'scripts/check-docs-social-card.mjs');
const ORIGIN = 'https://beeui.example.com';

/**
 * Runs the real CLI in its own process, so the value `main` returns has to survive the one line
 * that hands it to the process.
 *
 * @param {string[]} args
 * @param {string} [script]
 * @returns {Promise<{code: number, stderr: string, stdout: string}>}
 */
function runScript(args, script = SCRIPT_FILE) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stderr, stdout }));
  });
}

/**
 * Encodes a 1200x630 8-bit RGB PNG from a per-pixel colour function.
 *
 * The content floors can only be trusted if something that satisfies every other rule — a real,
 * correctly sized, in-budget PNG — can still be built and shown to fail.
 *
 * @param {(x: number, y: number) => [number, number, number]} colorAt
 * @returns {Buffer}
 */
function pngOfSize(colorAt, { width = SOCIAL_CARD.width, height = SOCIAL_CARD.height } = {}) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colorAt(x, y);
      const at = y * (stride + 1) + 1 + x * 3;
      raw[at] = r;
      raw[at + 1] = g;
      raw[at + 2] = b;
    }
  }

  const chunk = (type, data) => {
    const out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), data.length + 8);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A valid, in-budget, correctly sized card that says nothing at all. */
const BLACK_CARD = pngOfSize(() => [0, 0, 0]);

/**
 * The plausible near-miss: the real background and the real decorative blob, but every text and
 * logo region left empty. The blob keeps it over the distinct-colour floor, so only the region
 * floors can reject it.
 */
const BACKGROUND_ONLY_CARD = pngOfSize((x, y) => {
  if (x > 820) return [11, 15, 20 + ((x + y) % 64)];
  return [11, 15, 20];
});

function page({ image = `${ORIGIN}/og-beeui.png`, card = 'summary_large_image', width = '1200', height = '630', alt = SOCIAL_CARD.alt } = {}) {
  return [
    '<!doctype html><html><head>',
    `<link rel="canonical" href="${ORIGIN}/page/" />`,
    card ? `<meta name="twitter:card" content="${card}" />` : '',
    image ? `<meta property="og:image" content="${image}" />` : '',
    width ? `<meta property="og:image:width" content="${width}" />` : '',
    height ? `<meta property="og:image:height" content="${height}" />` : '',
    alt ? `<meta property="og:image:alt" content="${alt.replaceAll('"', '&quot;')}" />` : '',
    '</head><body></body></html>',
  ].join('');
}

function distWith(pages, { withCard = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-social-card-'));
  for (const [name, html] of Object.entries(pages)) {
    fs.mkdirSync(path.join(dir, path.dirname(name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), html);
  }
  if (withCard) fs.copyFileSync(path.join(rootDir, SOCIAL_CARD.sourcePath), path.join(dir, SOCIAL_CARD.fileName));
  return dir;
}

function violationsFor(pages, options) {
  const distDir = distWith(pages, options);
  try {
    return collectDistSocialCardViolations({ distDir, routePrefix: '/', expectedOrigin: ORIGIN });
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
}

test('the committed card is a 1200x630 PNG within the size ceiling', () => {
  assert.deepEqual(collectCardFileViolations(path.join(rootDir, SOCIAL_CARD.sourcePath), SOCIAL_CARD.sourcePath), []);
  const buffer = fs.readFileSync(path.join(rootDir, SOCIAL_CARD.sourcePath));
  assert.deepEqual(readPngSize(buffer), { width: 1200, height: 630 });
});

test('the card artwork is derived from the dark theme tokens and the site contract', () => {
  const svg = renderSocialCardSvg(rootDir);
  assert.match(svg, /width="1200" height="630"/u);
  assert.match(svg, /fill="#0b0f14"/u, 'background must come from themes.dark.colors.background');
  assert.match(svg, /fill="#fbbf24"/u, 'brand mark must come from themes.dark.colors.primary');
  assert.match(svg, /beeui\.beemvp\.com/u, 'host must come from web/public-site.config.json');
  assert.ok(svg.includes(SOCIAL_CARD.tagline));
});

test('a compliant page passes', () => {
  assert.deepEqual(violationsFor({ 'index.html': page() }), []);
});

test('summary_large_image without og:image fails', () => {
  const violations = violationsFor({ 'index.html': page({ image: null }) });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /empty large card/u);
});

test('a relative og:image fails', () => {
  const violations = violationsFor({ 'index.html': page({ image: '/og-beeui.png' }) });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /not an absolute URL/u);
});

test('an og:image on another origin fails', () => {
  const violations = violationsFor({ 'index.html': page({ image: 'https://cdn.example.net/og-beeui.png' }) });
  assert.ok(violations.some((violation) => /does not match the page origin/u.test(violation)));
});

test('an og:image missing from the build output fails', () => {
  const violations = violationsFor({ 'index.html': page() }, { withCard: false });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /is missing/u);
});

test('an og:image that is not the advertised size fails', () => {
  const violations = violationsFor({ 'index.html': page({ width: '800', height: '418' }) });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /not 1200x630/u);
});

test('a card file that is not a PNG fails', () => {
  const distDir = distWith({ 'index.html': page() }, { withCard: false });
  try {
    fs.writeFileSync(path.join(distDir, SOCIAL_CARD.fileName), '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"></svg>');
    const violations = collectDistSocialCardViolations({ distDir, routePrefix: '/', expectedOrigin: ORIGIN });
    assert.ok(violations.some((violation) => /do not render SVG cards/u.test(violation)));
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
});

test('drifted alt text fails', () => {
  const violations = violationsFor({ 'index.html': page({ alt: 'Something else entirely' }) });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /drifted from the card contract/u);
});

test('a page without summary_large_image and without og:image is not required to carry one', () => {
  assert.deepEqual(violationsFor({ 'index.html': page({ card: 'summary', image: null, width: null, height: null, alt: null }) }), []);
});

test('metaContent matches the whole key, not a prefix', () => {
  const html = '<meta property="og:image:width" content="1200" /><meta property="og:image" content="x" />';
  assert.equal(metaContent(html, 'og:image'), 'x');
  assert.equal(metaContent(html, 'og:image:width'), '1200');
  assert.equal(metaContent(html, 'og:image:height'), undefined);
});

test('the docs gate reports an unbuilt portal instead of passing silently', () => {
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-social-card-root-'));
  try {
    const violations = collectDocsSocialCardViolations(emptyRoot);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /has no built pages/u);
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }
});

test('the generator CLI agrees the committed card is publishable', () => {
  assert.deepEqual(collectSocialCardAssetViolations(rootDir), []);
});

// --- the card has to be the card, not a rectangle of the right size ------------------------
// Shape rules (PNG signature, 1200x630, under the ceiling) are all satisfied by a blank image.
// These read the decoded pixels, so an empty or half-rendered card is a red.

test('the committed card carries the artwork the floors describe', () => {
  const measurement = measureCardContent(fs.readFileSync(path.join(rootDir, SOCIAL_CARD.sourcePath)));
  assert.ok(measurement, 'the committed card has to be decodable, or nothing below measures anything');
  assert.ok(
    measurement.distinctColors >= SOCIAL_CARD.minDistinctColors,
    `${measurement.distinctColors} distinct colours is under the ${SOCIAL_CARD.minDistinctColors} floor`,
  );
  for (const region of measurement.regions) {
    assert.ok(region.ink >= region.minInk, `${region.name} is ${(region.ink * 100).toFixed(1)}% drawn, under its ${region.minInk * 100}% floor`);
  }
  // The floors are a regression guard, not a target: a card that only just clears them would
  // mean the guard has quietly become a pixel-diff of the current design.
  assert.ok(measurement.distinctColors > SOCIAL_CARD.minDistinctColors * 4, 'the floors must keep real headroom under the committed card');
});

test('a blank card of exactly the right size fails', () => {
  const distDir = distWith({ 'index.html': page() }, { withCard: false });
  try {
    fs.writeFileSync(path.join(distDir, SOCIAL_CARD.fileName), BLACK_CARD);
    const violations = collectDistSocialCardViolations({ distDir, routePrefix: '/', expectedOrigin: ORIGIN });
    assert.ok(violations.some((violation) => /distinct colours/u.test(violation)), `expected a colour floor breach, got ${JSON.stringify(violations)}`);
    assert.ok(violations.some((violation) => /headline region/u.test(violation)), 'a card with no headline must say so');
    // Everything the old guard checked still passes on this file, which is the whole point.
    assert.deepEqual(readPngSize(BLACK_CARD), { width: 1200, height: 630 });
    assert.ok(BLACK_CARD.length < SOCIAL_CARD.maxBytes);
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
});

test('a card with the background but none of the text fails on every empty region', () => {
  const distDir = distWith({ 'index.html': page() }, { withCard: false });
  try {
    fs.writeFileSync(path.join(distDir, SOCIAL_CARD.fileName), BACKGROUND_ONLY_CARD);
    const violations = collectDistSocialCardViolations({ distDir, routePrefix: '/', expectedOrigin: ORIGIN });
    // Named rather than counted against SOCIAL_CARD.inkRegions: a contract with the regions
    // removed would satisfy a count comparison while checking nothing.
    for (const region of ['logo box', 'headline', 'tagline']) {
      assert.ok(
        violations.some((violation) => violation.includes(`in the ${region} region`)),
        `the empty ${region} must be reported, got ${JSON.stringify(violations)}`,
      );
    }
    // It clears the colour floor, so the region floors are what rejected it.
    assert.ok(measureCardContent(BACKGROUND_ONLY_CARD).distinctColors >= SOCIAL_CARD.minDistinctColors);
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
});

test('a card the decoder cannot read is reported, not skipped', () => {
  // 16-bit channels: a legitimate PNG, but not one this decoder inspects. Silently passing it
  // would be a way to ship any image at all.
  const sixteenBit = Buffer.from(BLACK_CARD);
  sixteenBit[24] = 16; // IHDR bit depth
  assert.equal(decodePngPixels(sixteenBit), null);
  assert.deepEqual(collectCardContentViolationsFor(sixteenBit), [
    'card could not be decoded as an 8-bit non-interlaced PNG, so nothing here proves it is the card. Run: pnpm docs:og-image',
  ]);
});

function collectCardContentViolationsFor(buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-social-card-file-'));
  try {
    const file = path.join(dir, SOCIAL_CARD.fileName);
    fs.writeFileSync(file, buffer);
    return collectCardFileViolations(file, 'card');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- the tagline the card cannot re-render for itself --------------------------------------
// The tagline is pixels in a committed PNG, so the only thing that can notice the portal
// description moving away from it is this rule. It is reachable only past the "no built pages"
// return, so it needs a fixture with a page in it.

function docsFixture(pages) {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-social-card-dist-'));
  for (const [name, html] of Object.entries(pages)) fs.writeFileSync(path.join(distDir, name), html);
  return distDir;
}

const NEUTRAL_PAGE = '<!doctype html><html><head><title>x</title></head><body></body></html>';

test('the docs gate fails when astro.config.mjs stops saying what the card says', () => {
  const distDir = docsFixture({ 'index.html': NEUTRAL_PAGE });
  const configFile = path.join(distDir, 'astro.config.mjs');
  try {
    fs.writeFileSync(configFile, "export default { description: 'A pragmatic React Native UI' };\n");
    const violations = collectDocsSocialCardViolations(rootDir, { configPath: configFile, distDir });
    assert.equal(violations.length, 1, `expected only the tagline drift, got ${JSON.stringify(violations)}`);
    assert.match(violations[0], /no longer describes the portal as "Production-oriented React Native UI"/u);

    // Positive control: the same fixture with the committed config is clean, so the assertion
    // above is the rule firing and not the fixture being broken.
    fs.writeFileSync(configFile, `export default { description: '${SOCIAL_CARD.tagline} for everyone' };\n`);
    assert.deepEqual(collectDocsSocialCardViolations(rootDir, { configPath: configFile, distDir }), []);
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
});

test('the committed portal config still carries the tagline rendered into the card', () => {
  const config = fs.readFileSync(path.join(rootDir, 'apps/docs/astro.config.mjs'), 'utf8');
  assert.ok(config.toLowerCase().includes(SOCIAL_CARD.tagline.toLowerCase()));
});

// --- the entrypoint ------------------------------------------------------------------------
// This file is invoked by path from `apps/docs`'s build script, so the mapping from verdict to
// exit code is the entire enforcement surface: a gate that prints every violation and exits 0 is
// off. `run` returns the code, `main` maps a crash onto one too, and the spawn tests below prove
// the single remaining line delivers it to the process.

const BREACHED_PAGE = '<!doctype html><html><head><meta name="twitter:card" content="summary_large_image" /></head><body></body></html>';

test('run returns 1 on a breach and 0 on a pass, and reports both to the right stream', () => {
  const distDir = docsFixture({ 'index.html': BREACHED_PAGE });
  try {
    const errors = [];
    const logs = [];
    assert.equal(run({ argv: ['--check', `--dist=${distDir}`], log: (line) => logs.push(line), logError: (line) => errors.push(line) }), 1);
    assert.ok(errors.some((line) => /empty large card/u.test(line)), `expected the breach on stderr, got ${JSON.stringify(errors)}`);

    // Without --check the same breach is reported and the command still succeeds: reporting is
    // not gating, and the two must not be confused for one another.
    assert.equal(run({ argv: [`--dist=${distDir}`], log: () => {}, logError: () => {} }), 0);

    fs.writeFileSync(path.join(distDir, 'index.html'), NEUTRAL_PAGE);
    assert.equal(run({ argv: ['--check', `--dist=${distDir}`], log: () => {}, logError: () => {} }), 0);
  } finally {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
});

test('the entrypoint returns the verdict the run produced, it does not re-decide it', () => {
  for (const verdict of [0, 1]) {
    assert.equal(main(['--check'], { execute: () => verdict, logError: () => {} }), verdict, `a run that returned ${verdict} must exit ${verdict}`);
  }
});

test('the entrypoint turns a crash into a failing exit code and says why', () => {
  const errors = [];
  const code = main([], {
    execute: () => {
      throw new Error('apps/docs/dist has no built pages.');
    },
    logError: (line) => errors.push(line),
  });

  assert.equal(code, 1, 'a check that could not run must not report success');
  assert.deepEqual(errors, ['apps/docs/dist has no built pages.']);
});

test('the entrypoint passes the command line through instead of choosing its own', () => {
  const seen = [];
  main(['--check', '--dist=/tmp/other-dist'], {
    execute: ({ argv }) => {
      seen.push(argv);
      return 0;
    },
    logError: () => {},
  });
  assert.deepEqual(seen, [['--check', '--dist=/tmp/other-dist']]);
});

test('an argument this command does not accept is an error, not a silent report-only run', () => {
  assert.deepEqual(parseArguments(['--check']), { check: true, distDir: undefined });
  assert.equal(parseArguments(['--dist=web/dist']).distDir, path.resolve('web/dist'));
  assert.throws(() => parseArguments(['--check=1']), /unknown argument/u);
  assert.throws(() => parseArguments(['--chek']), /unknown argument/u);
  assert.throws(() => parseArguments(['--dist']), /unknown argument/u);
  assert.throws(() => parseArguments(['--dist=']), /--dist needs a path/u);
});

test('the CLI exits non-zero on a real breach and zero on a real pass', async () => {
  const { buildPublicSiteContract } = await import('../public-site-contract-lib.mjs');
  const { docsBase } = buildPublicSiteContract(rootDir);
  const base = docsBase.endsWith('/') ? docsBase : `${docsBase}/`;
  const compliant = docsFixture({
    'index.html': [
      '<!doctype html><html><head>',
      `<link rel="canonical" href="${ORIGIN}${base}" />`,
      '<meta name="twitter:card" content="summary_large_image" />',
      `<meta property="og:image" content="${ORIGIN}${base}${SOCIAL_CARD.fileName}" />`,
      '<meta property="og:image:width" content="1200" />',
      '<meta property="og:image:height" content="630" />',
      `<meta property="og:image:alt" content="${SOCIAL_CARD.alt.replaceAll('"', '&quot;')}" />`,
      '</head><body></body></html>',
    ].join(''),
  });
  fs.copyFileSync(path.join(rootDir, SOCIAL_CARD.sourcePath), path.join(compliant, SOCIAL_CARD.fileName));
  const broken = docsFixture({
    'index.html': '<!doctype html><html><head><meta name="twitter:card" content="summary_large_image" /></head><body></body></html>',
  });

  try {
    const passing = await runScript(['--check', `--dist=${compliant}`]);
    assert.equal(passing.code, 0, `expected a clean build to pass\n${passing.stdout}${passing.stderr}`);
    assert.match(passing.stdout, /gate passed: 1\/1 pages carry og:image/u);
    assert.match(passing.stdout, /not the built portal/u, "a run against another build must not read as the portal's own");

    const failing = await runScript(['--check', `--dist=${broken}`]);
    assert.equal(failing.code, 1, `expected a broken build to fail\n${failing.stdout}${failing.stderr}`);
    assert.match(failing.stderr, /Docs social-card gate failed:/u);
    assert.match(failing.stderr, /empty large card/u, 'the exit code has to come from the verdict, not from a crash');
  } finally {
    fs.rmSync(compliant, { recursive: true, force: true });
    fs.rmSync(broken, { recursive: true, force: true });
  }
});

// --- the generator's own entrypoint ---------------------------------------------------------
// `--check` is wired into `pnpm -w typecheck` through docs:social-card:asset-check, so the same
// verdict-to-exit-code mapping is load-bearing there.

test('the generator entrypoint returns the verdict, and turns a crash into one', async () => {
  for (const verdict of [0, 1]) {
    assert.equal(await generatorMain(['--check'], { execute: async () => verdict, logError: () => {} }), verdict);
  }
  const errors = [];
  const code = await generatorMain([], {
    execute: async () => {
      throw new Error('Cannot load Playwright Chromium from apps/visual-regression.');
    },
    logError: (line) => errors.push(line),
  });
  assert.equal(code, 1);
  assert.deepEqual(errors, ['Cannot load Playwright Chromium from apps/visual-regression.']);
});

// The floors are a calibration, and a calibration nothing asserts drifts back. A logo box that
// keeps the solid square but loses its letter measures 7.1%; the committed card measures 19.4%.
// A floor at or below 7.1% cannot tell those apart, which is what the 5% it shipped with did.
test('each ink floor sits between an empty region and what the card actually draws', () => {
  const measured = measureCardContent(fs.readFileSync(path.join(rootDir, SOCIAL_CARD.sourcePath)));
  const EMPTY_LOGO_BOX_INK = 0.071;

  const logo = SOCIAL_CARD.inkRegions.find((region) => region.name === 'logo box');
  assert.ok(
    logo.minInk > EMPTY_LOGO_BOX_INK,
    `the logo-box floor (${logo.minInk}) must exceed the ${EMPTY_LOGO_BOX_INK} an empty box measures, or a card that lost its wordmark passes`,
  );

  for (const region of measured.regions) {
    assert.ok(region.ink > region.minInk, `${region.name} draws ${region.ink}, at or under its own floor ${region.minInk}`);
  }
});

// `run` takes the root it reads the card from, so a real asset-check breach can be driven
// without touching the committed card. Without this, `run` could return 0 on a breach — printing
// every violation and exiting 0 — with the whole suite green.
test('the generator returns a failing code when the card it checks is missing', async () => {
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-og-missing-'));
  try {
    const errors = [];
    const code = await generatorRun({
      argv: ['--check'],
      rootDir: emptyRoot,
      log: () => {},
      logError: (line) => errors.push(line),
    });
    assert.equal(code, 1, 'a missing card is a breach, not a pass');
    assert.match(errors.join('\n'), /is missing/u);
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }
});

test('the generator CLI delivers its exit code to the process', async () => {
  // The rejected argument takes the same single assignment to `process.exitCode` as a verdict,
  // so it proves that line is still there; the verdict itself is covered by the test above.
  const rejected = await runScript(['--nope'], path.join(rootDir, 'scripts/generate-og-image.mjs'));
  assert.equal(rejected.code, 1, `expected a rejected argument to fail\n${rejected.stdout}${rejected.stderr}`);
  assert.match(rejected.stderr, /unknown argument: --nope/u);

  const checked = await runScript(['--check'], path.join(rootDir, 'scripts/generate-og-image.mjs'));
  assert.equal(checked.code, 0, `expected the committed card to pass\n${checked.stdout}${checked.stderr}`);
  assert.match(checked.stdout, /Social card is a 1200x630 PNG/u);
});
