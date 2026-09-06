#!/usr/bin/env node

// Core Web Vitals measurement for the documentation portal (#474 WBS-H075).
//
// `check-docs-page-budget.mjs` limits what a page *weighs*. Nothing measured what a reader
// *waits for*: a page can sit under 32 KB gzipped and still block the main thread for a second
// on a mid-range phone. This runs Lighthouse against the built portal and holds the three field
// metrics Lighthouse can produce in a lab, plus the performance score.
//
// WHAT THIS CHECK PROVES
//   - On a simulated mid-range phone (Lighthouse's default mobile preset: Moto G Power class
//     CPU throttling, slow-4G Lantern network simulation), the measured pages stay under the
//     ceilings in docs/web-vitals.budget.json.
//   - It measures the real built `apps/docs/dist`, served over HTTP with gzip on — the same
//     compression Cloudflare applies in production. Serving the 163 KB uncompressed table page
//     over a simulated slow link would measure a transfer no reader ever performs.
//
// WHAT THIS CHECK DOES NOT PROVE
//   - These are LAB numbers, not field data. LCP and CLS here come from one scripted load of a
//     cold page; they are not Core Web Vitals as Chrome's CrUX report measures them, and they
//     say nothing about real readers on real networks.
//   - TBT is a *proxy* for INP, not INP. Lighthouse cannot measure INP in a lab because INP
//     needs real interactions; TBT correlates with it and is what Lighthouse scores.
//   - Five pages, not 151. The generated component and pattern pages share one template, so the
//     sample is one page per template family. A hand-authored page outside the set can regress
//     without this check noticing.
//   - The ceilings are a *regression* guard, derived from measured values (see the budget file),
//     not a statement that the portal is fast. Lab runs vary by roughly 10% run to run, so a
//     single breach near the line is worth re-running before treating it as a regression.
//
//   node scripts/check-docs-web-vitals.mjs           # measure and report
//   node scripts/check-docs-web-vitals.mjs --check   # fail if any ceiling is exceeded
//
// Requires a built portal (`pnpm docs:build`) and a Chrome/Chromium binary. Lighthouse discovers
// and launches that browser itself; this script does not choose the binary, so which Chrome
// measured a run is only knowable from the machine it ran on. A browser Lighthouse cannot drive
// fails the run loudly — it never degrades into a silent pass.
//
// NOT WIRED INTO CI. Unlike the page-weight and search-intent checks, this one is not part of
// `apps/docs`'s build script: it needs a browser and about a minute per page, which would make
// every docs build pay for it. Running it in CI is an owner decision.

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DOCS_DIST_DIR = path.join(ROOT_DIR, 'apps/docs/dist');
export const BUDGET_FILE = path.join(ROOT_DIR, 'docs/web-vitals.budget.json');
// Gitignored: a measurement is evidence for one run on one machine, not a tracked artifact.
export const REPORT_FILE = path.join(ROOT_DIR, '.artifacts/docs-web-vitals.json');

// Pinned: an unpinned Lighthouse would silently change the scoring curve under the ceilings,
// and a budget breach would then mean "Lighthouse changed", not "the portal got slower".
export const LIGHTHOUSE_SPEC = 'lighthouse@13.4.1';

// A run that hangs must fail rather than stall a CI job forever. Generous: a cold `pnpm dlx`
// resolution plus a throttled load of the heaviest page takes well under this.
export const PAGE_TIMEOUT_MS = 240_000;

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

// Cloudflare compresses these on the way out, so the fixture server does too. Fonts, PNG and
// WebP are already compressed; gzipping them again would measure a transfer nobody performs.
const COMPRESSIBLE = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt', '.xml']);

/**
 * Serves a built portal directory on a free loopback port.
 *
 * Astro builds the portal without its public base (the Cloudflare Worker mounts it at /docs), so
 * paths here are dist-relative — `/components/button/`, not `/docs/components/button/`. The
 * prefix changes no byte Lighthouse measures.
 *
 * @param {string} distDir
 * @returns {Promise<import('node:http').Server>}
 */
export function serveDist(distDir) {
  return new Promise((resolveReady, rejectReady) => {
    const root = path.resolve(distDir);
    const server = createServer(async (req, res) => {
      try {
        // A malformed escape (`%zz`) throws URIError. Uncaught in a request handler it takes the
        // process down, so one bad request would end the measurement.
        let requestPath;
        try {
          requestPath = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
        } catch {
          res.writeHead(400);
          res.end('bad request');
          return;
        }

        let filePath = path.resolve(path.join(root, requestPath));
        if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
          res.writeHead(403);
          res.end('forbidden');
          return;
        }

        const stats = await stat(filePath).catch(() => null);
        // A directory serves its own index, never the site root: a 200 for a renamed route would
        // measure the landing page while claiming to measure the renamed one.
        if (stats?.isDirectory()) filePath = path.join(filePath, 'index.html');

        const body = await readFile(filePath);
        const extension = path.extname(filePath);
        const acceptsGzip = String(req.headers['accept-encoding'] ?? '').includes('gzip');
        const headers = {
          'cache-control': 'no-store',
          'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
        };

        if (acceptsGzip && COMPRESSIBLE.has(extension)) {
          const compressed = gzipSync(body, { level: 6 });
          res.writeHead(200, { ...headers, 'content-encoding': 'gzip' });
          res.end(compressed);
          return;
        }
        res.writeHead(200, headers);
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.on('error', rejectReady);
    server.listen(0, '127.0.0.1', () => resolveReady(server));
  });
}

/**
 * Reads and validates the committed budget file.
 *
 * @param {string} [file]
 * @returns {Promise<{budget: Record<string, number>, pages: {name: string, path: string}[]}>}
 */
export async function loadBudget(file = BUDGET_FILE) {
  const raw = await readFile(file, 'utf8').catch(() => null);
  if (raw === null) throw new Error(`No budget file at ${file}.`);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${error.message}`);
  }
  return assertBudgetShape(parsed, file);
}

const BUDGET_KEYS = [
  'largestContentfulPaintMs',
  'totalBlockingTimeMs',
  'cumulativeLayoutShift',
  'minPerformanceScore',
];

/**
 * Fails loudly on a budget file that would otherwise enforce nothing — a missing key, a string
 * where a number belongs, or an empty page list all read as "everything passed".
 *
 * @param {unknown} parsed
 * @param {string} file
 */
export function assertBudgetShape(parsed, file = BUDGET_FILE) {
  if (!parsed || typeof parsed !== 'object') throw new Error(`${file} must contain an object.`);
  const { budget, pages } = /** @type {{budget?: unknown, pages?: unknown}} */ (parsed);

  if (!budget || typeof budget !== 'object') throw new Error(`${file} has no "budget" object.`);
  for (const key of BUDGET_KEYS) {
    const value = /** @type {Record<string, unknown>} */ (budget)[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${file}: budget.${key} must be a finite number, got ${JSON.stringify(value)}.`);
    }
  }

  if (!Array.isArray(pages) || pages.length === 0) throw new Error(`${file} lists no pages to measure.`);
  for (const page of pages) {
    if (!page || typeof page.name !== 'string' || typeof page.path !== 'string' || !page.path.startsWith('/')) {
      throw new Error(`${file}: every page needs a "name" and a site-absolute "path", got ${JSON.stringify(page)}.`);
    }
  }
  return /** @type {{budget: Record<string, number>, pages: {name: string, path: string}[]}} */ (parsed);
}

/**
 * Compares measured Lighthouse metrics against the ceilings.
 *
 * Pure and total: a metric that is missing or not a number is a violation, never a pass. A
 * Lighthouse run that errors out returns nulls, and treating those as "under budget" is how a
 * check reports green while measuring nothing.
 *
 * @param {{name: string, path: string, largestContentfulPaintMs?: unknown, totalBlockingTimeMs?: unknown, cumulativeLayoutShift?: unknown, performanceScore?: unknown}[]} measurements
 * @param {Record<string, number>} budget
 * @returns {string[]} one human-readable line per breach, empty when everything is under budget
 */
export function collectVitalsViolations(measurements, budget) {
  if (!Array.isArray(measurements) || measurements.length === 0) {
    return ['No pages were measured. Run the docs build first (pnpm docs:build).'];
  }

  const violations = [];
  for (const page of measurements) {
    const label = `${page.name} (${page.path})`;

    const ceilings = [
      { key: 'largestContentfulPaintMs', limit: budget.largestContentfulPaintMs, unit: ' ms', metric: 'LCP' },
      { key: 'totalBlockingTimeMs', limit: budget.totalBlockingTimeMs, unit: ' ms', metric: 'TBT' },
      { key: 'cumulativeLayoutShift', limit: budget.cumulativeLayoutShift, unit: '', metric: 'CLS' },
    ];
    for (const { key, limit, unit, metric } of ceilings) {
      const value = page[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        violations.push(`${label}: ${metric} was not measured (got ${JSON.stringify(value)}).`);
        continue;
      }
      if (value > limit) {
        violations.push(`${label}: ${metric} ${formatMetric(key, value)}${unit}, over the ${formatMetric(key, limit)}${unit} budget.`);
      }
    }

    const score = page.performanceScore;
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      violations.push(`${label}: performance score was not measured (got ${JSON.stringify(score)}).`);
    } else if (score < budget.minPerformanceScore) {
      violations.push(
        `${label}: performance score ${score.toFixed(2)}, under the ${budget.minPerformanceScore.toFixed(2)} floor.`,
      );
    }
  }
  return violations;
}

function formatMetric(key, value) {
  return key === 'cumulativeLayoutShift' ? value.toFixed(3) : Math.round(value).toString();
}

/**
 * Chrome flags for one Lighthouse run.
 *
 * `--headless=new` is the current Chrome headless mode. `--no-sandbox` is added only where the
 * sandbox cannot work anyway — as root (the default user in most containers) Chrome refuses to
 * start with it, and CI runners do not grant the privileges it needs. On a developer machine the
 * sandbox is available, and measuring a local static site is no reason to switch it off.
 *
 * @param {{uid?: number, ci?: string}} [environment]
 * @returns {string[]}
 */
export function chromeFlagsFor({ uid, ci } = {}) {
  const flags = ['--headless=new', '--disable-gpu', '--disable-dev-shm-usage'];
  if (uid === 0 || Boolean(ci)) flags.push('--no-sandbox');
  return flags;
}

/**
 * Runs the pinned Lighthouse CLI once against `url` and returns its parsed report.
 *
 * @param {string} url
 * @param {{timeoutMs?: number, outputDir: string, name: string}} options
 * @returns {Promise<object>} the Lighthouse result object (LHR)
 */
async function runLighthouse(url, { timeoutMs = PAGE_TIMEOUT_MS, outputDir, name }) {
  const outputPath = path.join(outputDir, `${name}.report.json`);
  const chromeFlags = chromeFlagsFor({ ci: process.env.CI, uid: process.getuid?.() });
  const args = [
    'dlx',
    LIGHTHOUSE_SPEC,
    url,
    '--quiet',
    '--only-categories=performance',
    '--output=json',
    `--output-path=${outputPath}`,
    `--chrome-flags=${chromeFlags.join(' ')}`,
  ];

  const stderr = await new Promise((resolveRun, rejectRun) => {
    const child = spawn('pnpm', args, { cwd: ROOT_DIR, stdio: ['ignore', 'ignore', 'pipe'] });
    let errorOutput = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      rejectRun(new Error(`Lighthouse timed out after ${timeoutMs} ms on ${url}.`));
    }, timeoutMs);

    child.stderr.on('data', (chunk) => {
      errorOutput += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      rejectRun(new Error(`Could not start Lighthouse (${LIGHTHOUSE_SPEC}): ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        rejectRun(new Error(`Lighthouse exited ${code} on ${url}.\n${errorOutput.trim()}`));
        return;
      }
      resolveRun(errorOutput);
    });
  });

  const raw = await readFile(outputPath, 'utf8').catch(() => null);
  if (raw === null) throw new Error(`Lighthouse wrote no report for ${url}.\n${stderr.trim()}`);

  const lhr = JSON.parse(raw);
  if (lhr.runtimeError?.code && lhr.runtimeError.code !== 'NO_ERROR') {
    throw new Error(`Lighthouse could not load ${url}: ${lhr.runtimeError.message ?? lhr.runtimeError.code}`);
  }
  return lhr;
}

/**
 * Measures every configured page against the built portal.
 *
 * @param {{distDir?: string, pages: {name: string, path: string}[]}} options
 * @returns {Promise<{lighthouseVersion: string, pages: object[]}>}
 */
export async function measureDocsVitals({ distDir = DOCS_DIST_DIR, pages }) {
  const distStats = await stat(distDir).catch(() => null);
  if (!distStats?.isDirectory()) {
    throw new Error(`No built portal at ${distDir}. Run the docs build first (pnpm docs:build).`);
  }

  const server = await serveDist(distDir);
  const { port } = server.address();
  const outputDir = await mkdtemp(path.join(tmpdir(), 'beeui-web-vitals-'));
  const measured = [];
  let lighthouseVersion = 'unknown';

  try {
    for (const page of pages) {
      const url = `http://127.0.0.1:${port}${page.path}`;
      const lhr = await runLighthouse(url, { name: page.name, outputDir });
      lighthouseVersion = lhr.lighthouseVersion ?? lighthouseVersion;
      measured.push({
        name: page.name,
        path: page.path,
        largestContentfulPaintMs: lhr.audits?.['largest-contentful-paint']?.numericValue ?? null,
        totalBlockingTimeMs: lhr.audits?.['total-blocking-time']?.numericValue ?? null,
        cumulativeLayoutShift: lhr.audits?.['cumulative-layout-shift']?.numericValue ?? null,
        firstContentfulPaintMs: lhr.audits?.['first-contentful-paint']?.numericValue ?? null,
        performanceScore: lhr.categories?.performance?.score ?? null,
      });
    }
  } finally {
    server.close();
    await rm(outputDir, { force: true, recursive: true });
  }

  return { lighthouseVersion, pages: measured };
}

function summarize(measurements) {
  const lines = [
    `${'page'.padEnd(26)}${'LCP'.padStart(9)}${'TBT'.padStart(9)}${'CLS'.padStart(8)}${'perf'.padStart(7)}`,
  ];
  for (const page of measurements) {
    lines.push(
      page.name.padEnd(26) +
        `${formatMetric('largestContentfulPaintMs', page.largestContentfulPaintMs ?? NaN)} ms`.padStart(9) +
        `${formatMetric('totalBlockingTimeMs', page.totalBlockingTimeMs ?? NaN)} ms`.padStart(9) +
        formatMetric('cumulativeLayoutShift', page.cumulativeLayoutShift ?? NaN).padStart(8) +
        (typeof page.performanceScore === 'number' ? page.performanceScore.toFixed(2) : 'n/a').padStart(7),
    );
  }
  return lines.join('\n');
}

/**
 * Writes the measurement report next to the other build artifacts.
 *
 * @param {{budget: Record<string, number>, lighthouseVersion: string, pages: object[], violations: string[]}} report
 * @returns {Promise<string>} the file written
 */
async function writeVitalsReport({ budget, lighthouseVersion, pages, violations }) {
  await mkdir(path.dirname(REPORT_FILE), { recursive: true });
  await writeFile(
    REPORT_FILE,
    `${JSON.stringify({ budget, generatedAt: new Date().toISOString(), lighthouseVersion, pages, violations }, null, 2)}\n`,
  );
  return REPORT_FILE;
}

/**
 * The whole command: load the budget, measure, report, and decide the exit code.
 *
 * Everything that touches a browser, the clock or the filesystem is injected, so the decision this
 * function makes — which is the part that can silently stop failing — is testable without running
 * Lighthouse. The measurement itself is still the real thing in the CLI path below.
 *
 * @param {{argv?: string[], measure?: typeof measureDocsVitals, readBudget?: typeof loadBudget, writeReport?: typeof writeVitalsReport, log?: (line: string) => void, logError?: (line: string) => void}} [options]
 * @returns {Promise<number>} the process exit code: 0 when passing or when not asked to check
 */
export async function run({
  argv = [],
  measure = measureDocsVitals,
  readBudget = loadBudget,
  writeReport = writeVitalsReport,
  log = console.log,
  logError = console.error,
} = {}) {
  const { budget, pages } = await readBudget();
  const { lighthouseVersion, pages: measurements } = await measure({ pages });
  const violations = collectVitalsViolations(measurements, budget);

  const reportFile = await writeReport({ budget, lighthouseVersion, pages: measurements, violations });

  log(summarize(measurements));
  log(
    `\nMeasured with Lighthouse ${lighthouseVersion} (mobile emulation). Report: ` +
      `${path.relative(ROOT_DIR, reportFile)}`,
  );

  if (!argv.includes('--check')) return 0;

  if (violations.length) {
    logError('\nDocumentation portal Core Web Vitals budget exceeded:');
    for (const violation of violations) logError(`- ${violation}`);
    logError(
      '\nLab numbers vary by roughly 10% run to run; re-run once before treating a near-miss as a regression.',
    );
    return 1;
  }
  log(
    `Web vitals check passed (${measurements.length} pages; ceilings LCP ${budget.largestContentfulPaintMs} ms, ` +
      `TBT ${budget.totalBlockingTimeMs} ms, CLS ${budget.cumulativeLayoutShift}, score ≥ ${budget.minPerformanceScore}).`,
  );
  return 0;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  // One assignment for both outcomes: a verdict and a crash reach the exit code by the same line,
  // so a test that proves one path is wired proves the other is too.
  process.exitCode = await run({ argv: process.argv.slice(2) }).catch((error) => {
    console.error(error.message);
    return 1;
  });
}
