// Pure analysis helpers for the bundle/package footprint baseline (#183).
//
// These functions take already-collected data (an `npm pack --dry-run --json`
// payload, an esbuild metafile) and derive the numbers the footprint report
// needs. They perform no I/O and no bundling themselves, so they are testable
// without a real npm/esbuild invocation — the same dependency-injection
// discipline the sampling harness uses for os/git/clock (see `lib/metadata.mjs`).

/**
 * Normalize a single `npm pack --dry-run --json` entry (the array's only
 * element for a non-workspace-aggregate pack) into the shape the footprint
 * report renders: packed (gzip tarball) bytes, unpacked bytes, and a
 * size-descending file inventory.
 *
 * @param {{name: string, version: string, size: number, unpackedSize: number,
 *   entryCount: number, files: Array<{path: string, size: number}>}} packEntry
 */
export function summarizePackEntry(packEntry) {
  if (!packEntry || typeof packEntry !== 'object') {
    throw new TypeError('summarizePackEntry requires an npm pack --json entry object');
  }
  const files = [...(packEntry.files ?? [])]
    .map((file) => ({ path: file.path, bytes: file.size }))
    .sort((a, b) => b.bytes - a.bytes);

  return {
    name: packEntry.name,
    version: packEntry.version,
    packedGzipBytes: packEntry.size,
    unpackedBytes: packEntry.unpackedSize,
    entryCount: packEntry.entryCount,
    files,
    largestFiles: files.slice(0, 5),
  };
}

/**
 * Attribute an esbuild metafile's bundled input bytes to "BeeUI-owned source"
 * (files under one of `ownedSourceDirs`) versus "bundled third-party
 * dependency" (any other non-external input, e.g. `class-variance-authority`,
 * `clsx`, `tailwind-merge`), and separately list every module specifier the
 * bundle referenced but left external (peer cost the consumer already pays
 * elsewhere, not shipped by this bundle).
 *
 * Input bytes are pre-minify source sizes from esbuild's own accounting, so
 * they are a proportional attribution of what went into the bundle, not the
 * exact post-minify byte contribution of each file — the report must use the
 * real output bytes (raw/gzip) for the shipped-size number and this
 * breakdown only for "where did it come from".
 *
 * @param {import('esbuild').Metafile} metafile
 * @param {string[]} ownedSourceDirs absolute directory prefixes considered BeeUI-owned
 */
export function summarizeBundleMetafile(metafile, ownedSourceDirs) {
  if (!metafile || typeof metafile !== 'object' || !metafile.inputs) {
    throw new TypeError('summarizeBundleMetafile requires an esbuild metafile with `inputs`');
  }
  if (!Array.isArray(ownedSourceDirs) || ownedSourceDirs.length === 0) {
    throw new TypeError('summarizeBundleMetafile requires a non-empty ownedSourceDirs array');
  }

  let ownedBytes = 0;
  let thirdPartyBytes = 0;
  const externalModules = new Set();
  const ownedFiles = [];
  const thirdPartyFiles = [];

  for (const [inputPath, input] of Object.entries(metafile.inputs)) {
    const isOwned = ownedSourceDirs.some((dir) => inputPath.startsWith(dir));
    if (isOwned) {
      ownedBytes += input.bytes;
      ownedFiles.push({ path: inputPath, bytes: input.bytes });
    } else {
      thirdPartyBytes += input.bytes;
      thirdPartyFiles.push({ path: inputPath, bytes: input.bytes });
    }
    for (const imp of input.imports ?? []) {
      // esbuild also tags a fully type-only import (e.g. `import { type X } from
      // './y'`) as `external: true` in the metafile once TypeScript erasure drops
      // it — that is a compile-time bookkeeping artifact, not a real runtime
      // dependency the consumer must supply. Real peer/optional dependencies are
      // always bare specifiers (e.g. `react`, `@gorhom/bottom-sheet`), never a
      // relative path, so only bare specifiers are counted as external modules.
      if (imp.external && !imp.path.startsWith('.') && !imp.path.startsWith('/')) {
        externalModules.add(imp.path);
      }
    }
  }

  ownedFiles.sort((a, b) => b.bytes - a.bytes);
  thirdPartyFiles.sort((a, b) => b.bytes - a.bytes);

  return {
    ownedSourceInputBytes: ownedBytes,
    thirdPartyDependencyInputBytes: thirdPartyBytes,
    externalModules: [...externalModules].sort(),
    largestOwnedFiles: ownedFiles.slice(0, 5),
    largestThirdPartyFiles: thirdPartyFiles.slice(0, 5),
  };
}

/**
 * Combine a bundled scenario's real output bytes (raw + gzip) with its
 * metafile attribution into one report row.
 *
 * @param {{id: string, title: string, platform: 'web'|'native'}} scenario
 * @param {{rawBytes: number, gzipBytes: number, metafile: import('esbuild').Metafile}} bundleResult
 * @param {string[]} ownedSourceDirs
 */
export function buildScenarioReport(scenario, bundleResult, ownedSourceDirs) {
  const attribution = summarizeBundleMetafile(bundleResult.metafile, ownedSourceDirs);
  return {
    id: scenario.id,
    title: scenario.title,
    platform: scenario.platform,
    rawBytes: bundleResult.rawBytes,
    gzipBytes: bundleResult.gzipBytes,
    ...attribution,
  };
}
