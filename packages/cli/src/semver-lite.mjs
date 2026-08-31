// Minimal, dependency-free semver parsing and range-overlap engine (#212).
//
// The CLI never adds a runtime dependency (registry-lib.mjs's own header
// comment explains why: `dist/` must stay a self-contained bundle with no
// node_modules resolution surprises). Every range this engine ever needs to
// evaluate is one of two controlled shapes:
//   1. BeeUI's own declared `peerDependencies`/`dependencies` ranges in
//      `registry/registry.json` (always well-formed, validated by
//      `validatePackageMap` before this module ever sees them).
//   2. A consumer's `package.json` dependency declaration, which can be an
//      exact pin, a caret/tilde/comparator range, a wildcard, a package
//      manager protocol (`workspace:`, `catalog:`, `npm:`, `file:`, `link:`,
//      a git/http URL), or a dist-tag (`latest`, `next`), or simply
//      malformed text.
//
// This module intentionally does not implement the full npm `node-semver`
// grammar (no hyphen ranges, no partial "1.2.x" wildcards inside a
// comparator). Those forms do not appear anywhere in this repository's own
// registry data, and are rare enough in consumer `package.json` peer
// declarations that treating them as "malformed" (rather than silently
// mis-evaluating them) is the honest choice per the project's own rule:
// "if a combination cannot be tested, narrow the promise instead of
// documenting hope" (docs/compatibility-matrix.md).

const VERSION_RE = /^v?(\d+)(?:\.(\d+)(?:\.(\d+))?)?(?:-([0-9A-Za-z-.]+))?(?:\+[0-9A-Za-z-.]+)?$/;

/**
 * Parses a single version token (not a range) into
 * `{ major, minor, patch, prerelease }`. Missing `minor`/`patch` default to
 * `0`. Returns `null` if `raw` is not a recognizable version token.
 */
export function parseVersion(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const match = VERSION_RE.exec(trimmed);
  if (!match) return null;
  const [, major, minor, patch, prerelease] = match;
  return {
    major: Number.parseInt(major, 10),
    minor: minor === undefined ? 0 : Number.parseInt(minor, 10),
    patch: patch === undefined ? 0 : Number.parseInt(patch, 10),
    prerelease: prerelease ? prerelease.split('.') : [],
    precision: patch !== undefined ? 3 : minor !== undefined ? 2 : 1,
  };
}

function comparePrereleaseIdentifier(a, b) {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);
  if (aNumeric && bNumeric) return Number.parseInt(a, 10) - Number.parseInt(b, 10);
  if (aNumeric) return -1;
  if (bNumeric) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Standard semver precedence: compares two parsed versions, ignoring
 * `precision`. A version with no prerelease is always greater than the same
 * `major.minor.patch` with a prerelease.
 */
export function compareVersions(a, b) {
  for (const field of ['major', 'minor', 'patch']) {
    if (a[field] !== b[field]) return a[field] - b[field];
  }
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (a.prerelease[index] === undefined) return -1;
    if (b.prerelease[index] === undefined) return 1;
    const cmp = comparePrereleaseIdentifier(a.prerelease[index], b.prerelease[index]);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

const PROTOCOL_PREFIX_RE = /^(workspace:|catalog:|npm:|file:|link:|git\+|git:|https?:|github:)/i;
// npm's own recognized dist-tag vocabulary (npm does not allow arbitrary
// free-form tag names in practice; these are the ones actually used in the
// wild). Deliberately an allowlist, not a generic "looks like a bare word"
// regex: a genuinely malformed declaration (e.g. a typo'd version string)
// often *also* looks like a bare hyphenated word, and must be reported as
// `'malformed'`, not silently treated as an unverifiable-but-legitimate
// dist-tag reference.
const KNOWN_DIST_TAGS = new Set(['latest', 'next', 'canary', 'beta', 'alpha', 'rc', 'experimental', 'nightly']);

/**
 * True when `raw` is a declaration this module cannot evaluate at all — a
 * package-manager protocol or a known npm dist-tag — as opposed to a
 * malformed version/range string. Callers should report these as
 * "unverifiable", never as "incompatible" (which would imply we know the
 * resolved version and it fails the check) or "malformed" (which would
 * imply the string is simply broken).
 */
export function isProtocolDeclaration(raw) {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed === '') return false;
  if (PROTOCOL_PREFIX_RE.test(trimmed)) return true;
  return KNOWN_DIST_TAGS.has(trimmed.toLowerCase());
}

const WILDCARD_RE = /^[xX*]$/;

// Every low/high boundary produced below must carry a `prerelease` array
// (even when empty) — `compareVersions`/`versionInInterval` read it
// unconditionally on both operands.
function point(major, minor, patch, prerelease = []) {
  return { major, minor, patch, prerelease };
}

function expandCaret(version) {
  const { major, minor, patch } = version;
  if (major > 0) return { low: point(major, minor, patch), high: point(major + 1, 0, 0) };
  if (minor > 0) return { low: point(major, minor, patch), high: point(major, minor + 1, 0) };
  return { low: point(major, minor, patch), high: point(major, minor, patch + 1) };
}

function expandTilde(version) {
  const { major, minor, patch, precision } = version;
  if (precision >= 2) return { low: point(major, minor, patch), high: point(major, minor + 1, 0) };
  return { low: point(major, 0, 0), high: point(major + 1, 0, 0) };
}

function expandBare(version) {
  // A fully-specified bare token ("0.7.1") is an exact pin. A partial bare
  // token ("19", "1.10") is an X-range: any version sharing the specified
  // prefix.
  const { major, minor, patch, precision, prerelease } = version;
  if (precision === 3) return { low: point(major, minor, patch, prerelease), high: point(major, minor, patch, prerelease) };
  if (precision === 2) return { low: point(major, minor, 0), high: point(major, minor + 1, 0) };
  return { low: point(major, 0, 0), high: point(major + 1, 0, 0) };
}

const ZERO = Object.freeze(point(0, 0, 0));
const INFINITY = Object.freeze(point(Number.POSITIVE_INFINITY, 0, 0));

function bound(version) {
  return point(version.major, version.minor, version.patch, version.prerelease);
}

/**
 * Parses one whitespace-separated comparator token (e.g. `>=19`, `^0.1.0`,
 * `~1.2.3`, `24.13.1`, `*`) into a half-open interval
 * `{ low, lowInclusive, high, highInclusive }` using `ZERO`/`INFINITY`
 * sentinels for unbounded sides. Returns `null` if the token cannot be
 * parsed at all.
 */
function parseComparatorToken(token) {
  if (WILDCARD_RE.test(token)) return { low: ZERO, lowInclusive: true, high: INFINITY, highInclusive: false };

  const opMatch = /^(>=|<=|>|<|=)?(.+)$/.exec(token);
  if (!opMatch) return null;
  const [, op, versionRaw] = opMatch;
  const version = parseVersion(versionRaw);
  if (!version) return null;

  if (!op || op === '=') {
    const { low, high } = expandBare(version);
    const exact = low.major === high.major && low.minor === high.minor && low.patch === high.patch;
    return { low, lowInclusive: true, high, highInclusive: exact };
  }
  if (op === '>=') return { low: bound(version), lowInclusive: true, high: INFINITY, highInclusive: false };
  if (op === '>') return { low: bound(version), lowInclusive: false, high: INFINITY, highInclusive: false };
  if (op === '<=') return { low: ZERO, lowInclusive: true, high: bound(version), highInclusive: true };
  if (op === '<') return { low: ZERO, lowInclusive: true, high: bound(version), highInclusive: false };
  return null;
}

function parseCaretOrTildeToken(token) {
  const marker = token[0];
  const version = parseVersion(token.slice(1));
  if (!version) return null;
  const { low, high } = marker === '^' ? expandCaret(version) : expandTilde(version);
  return { low, lowInclusive: true, high, highInclusive: false };
}

/**
 * Parses one AND-group token into a half-open interval. Handles `^`/`~`
 * separately from the plain comparator operators since their expansion rule
 * depends on which version fields are zero/specified.
 */
function parseToken(token) {
  if (token[0] === '^' || token[0] === '~') return parseCaretOrTildeToken(token);
  return parseComparatorToken(token);
}

function intersectIntervals(a, b) {
  let low = a.low;
  let lowInclusive = a.lowInclusive;
  if (compareVersions(b.low, a.low) > 0 || (compareVersions(b.low, a.low) === 0 && !b.lowInclusive)) {
    low = b.low;
    lowInclusive = b.lowInclusive;
  }
  let high = a.high;
  let highInclusive = a.highInclusive;
  if (compareVersions(b.high, a.high) < 0 || (compareVersions(b.high, a.high) === 0 && !b.highInclusive)) {
    high = b.high;
    highInclusive = b.highInclusive;
  }
  return { low, lowInclusive, high, highInclusive };
}

const FULL_RANGE = { low: ZERO, lowInclusive: true, high: INFINITY, highInclusive: false };

/**
 * Parses a full range string (`>=19 <20`, `^0.1.0`, `1.10.1`, `* `, ...) into
 * an array of half-open intervals — one per `||`-separated OR group, each
 * group itself the AND-intersection of its whitespace-separated comparator
 * tokens. Returns `null` if any token fails to parse (the whole range is
 * then "malformed" from the caller's point of view: a partially-evaluable
 * range is not honest to report as satisfied or incompatible).
 */
export function parseRange(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const orGroups = trimmed.split('||').map((group) => group.trim());
  const intervals = [];
  for (const group of orGroups) {
    const tokens = group.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;
    let interval = FULL_RANGE;
    for (const token of tokens) {
      const parsed = parseToken(token);
      if (!parsed) return null;
      interval = intersectIntervals(interval, parsed);
    }
    if (compareVersions(interval.low, interval.high) > 0) continue; // empty group, e.g. contradictory bounds
    intervals.push(interval);
  }
  return intervals;
}

function intervalsOverlap(a, b) {
  const lowCmp = compareVersions(a.low, b.low);
  const effectiveLow = lowCmp >= 0 ? a.low : b.low;
  const lowInclusive = lowCmp === 0 ? a.lowInclusive && b.lowInclusive : lowCmp > 0 ? a.lowInclusive : b.lowInclusive;
  const highCmp = compareVersions(a.high, b.high);
  const effectiveHigh = highCmp <= 0 ? a.high : b.high;
  const highInclusive = highCmp === 0 ? a.highInclusive && b.highInclusive : highCmp < 0 ? a.highInclusive : b.highInclusive;
  const cmp = compareVersions(effectiveLow, effectiveHigh);
  if (cmp < 0) return true;
  if (cmp > 0) return false;
  return lowInclusive && highInclusive;
}

/**
 * True if any interval of `rangeA` overlaps any interval of `rangeB`.
 * `rangeA`/`rangeB` are the arrays returned by `parseRange`. This function
 * deliberately ignores prerelease tags when computing interval overlap
 * (bounds are compared on `major.minor.patch` only) — full npm-semver
 * range-vs-range prerelease exclusion is not implemented; use
 * `versionSatisfiesRange` instead when checking one concrete (possibly
 * prerelease) version against a range, which does apply the standard
 * exclusion rule.
 */
export function intervalsOverlapAny(rangeAIntervals, rangeBIntervals) {
  for (const a of rangeAIntervals) {
    for (const b of rangeBIntervals) {
      if (intervalsOverlap(a, b)) return true;
    }
  }
  return false;
}

function versionInInterval(version, interval) {
  const lowCmp = compareVersions(version, interval.low);
  if (lowCmp < 0 || (lowCmp === 0 && !interval.lowInclusive)) return false;
  const highCmp = compareVersions(version, interval.high);
  if (highCmp > 0 || (highCmp === 0 && !interval.highInclusive)) return false;
  return true;
}

function sameTriple(a, b) {
  return a.major === b.major && a.minor === b.minor && a.patch === b.patch;
}

/**
 * Checks one concrete version (which may carry a prerelease tag) against a
 * range string, applying the standard semver default: a prerelease version
 * only satisfies a range if some bound of some OR-group shares its exact
 * `major.minor.patch` and itself carries a prerelease tag. Returns `null`
 * if `range` fails to parse.
 */
export function versionSatisfiesRange(version, range) {
  const intervals = parseRange(range);
  if (!intervals) return null;
  if (version.prerelease.length > 0) {
    const allowed = intervals.some(
      (interval) =>
        (sameTriple(version, interval.low) && interval.low.prerelease?.length) ||
        (sameTriple(version, interval.high) && interval.high.prerelease?.length),
    );
    if (!allowed) return false;
  }
  return intervals.some((interval) => versionInInterval(version, interval));
}

/**
 * The single classification entry point used by both `add`'s per-plan
 * dependency report and `doctor`'s project-wide diagnostics.
 *
 * `declaredRaw` is the exact string found in the consumer's `package.json`
 * (or `undefined`/`null` if the package is not declared at all — callers
 * should report that case as `'missing'` themselves; this function only
 * classifies a declaration that exists).
 *
 * Returns one of:
 *   - `'satisfied'`    — the declared range overlaps the required range.
 *   - `'incompatible'` — the declared range is well-formed but does not
 *                        overlap the required range.
 *   - `'unverifiable'` — the declaration is a package-manager protocol or a
 *                        dist-tag; its resolved version cannot be known
 *                        statically.
 *   - `'malformed'`    — the declared string is not a recognizable version,
 *                        range, protocol, or dist-tag.
 */
export function classifyDeclaredRange(declaredRaw, requiredRange) {
  if (isProtocolDeclaration(declaredRaw)) return 'unverifiable';

  const trimmed = declaredRaw.trim();
  const asExactVersion = parseVersion(trimmed);
  if (asExactVersion && asExactVersion.prerelease.length > 0) {
    const result = versionSatisfiesRange(asExactVersion, requiredRange);
    if (result === null) throw new Error(`internal error: BeeUI-required range '${requiredRange}' failed to parse`);
    return result ? 'satisfied' : 'incompatible';
  }

  const declaredIntervals = parseRange(trimmed);
  if (!declaredIntervals) return 'malformed';

  const requiredIntervals = parseRange(requiredRange);
  if (!requiredIntervals) throw new Error(`internal error: BeeUI-required range '${requiredRange}' failed to parse`);

  return intervalsOverlapAny(declaredIntervals, requiredIntervals) ? 'satisfied' : 'incompatible';
}
