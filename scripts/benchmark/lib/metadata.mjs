// Environment metadata capture.
//
// Every benchmark run records the environment it was produced on so results are
// comparable across time and machines and safe to use for trend/regression
// tracking. Nothing here is a performance claim — it is provenance.
//
// All external inputs (os, git, versions, package manifests, clock) are
// injectable so the collector is unit-testable without touching the real host,
// and so a native device runner can supply real device/build metadata that this
// host cannot observe.

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function readOsInfo() {
  const cpus = os.cpus() ?? [];
  return {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpuModel: cpus[0]?.model ?? null,
    cpuCores: cpus.length || null,
    cpuSpeedMHz: cpus[0]?.speed ?? null,
    totalMemoryBytes: os.totalmem(),
  };
}

function readGitInfo(cwd = ROOT_DIR) {
  const run = (args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    const sha = run(['rev-parse', 'HEAD']);
    let branch = null;
    try {
      branch = run(['rev-parse', '--abbrev-ref', 'HEAD']);
    } catch {
      branch = null;
    }
    const status = run(['status', '--porcelain']);
    return {
      sha,
      shortSha: sha.slice(0, 12),
      branch,
      dirty: status.length > 0,
    };
  } catch {
    return { sha: null, shortSha: null, branch: null, dirty: null };
  }
}

// Best-effort React Native version from the repository manifests. The Showcase
// app pins the exercised RN version; packages/ui declares the supported peer.
function readReactNativeVersion(cwd = ROOT_DIR) {
  const candidates = [
    path.join(cwd, 'apps', 'showcase', 'package.json'),
    path.join(cwd, 'packages', 'ui', 'package.json'),
  ];
  for (const manifestPath of candidates) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const version = manifest.dependencies?.['react-native'] ?? manifest.devDependencies?.['react-native'];
      if (version) return version;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function isCi(env) {
  return /^(1|true|yes)$/i.test(env.CI ?? '') || env.GITHUB_ACTIONS === 'true';
}

export function collectEnvironmentMetadata({
  platform = 'web',
  now = () => new Date().toISOString(),
  env = process.env,
  versions = process.versions,
  osInfo = readOsInfo(),
  git = readGitInfo(),
  reactNative = readReactNativeVersion(),
  device = null,
  browser = null,
} = {}) {
  if (platform !== 'web' && platform !== 'native') {
    throw new RangeError(`platform must be 'web' or 'native', received: ${String(platform)}`);
  }

  return {
    timestamp: now(),
    platform,
    ci: isCi(env),
    runtime: {
      name: 'node',
      node: versions.node ?? null,
      v8: versions.v8 ?? null,
    },
    os: {
      platform: osInfo.platform,
      release: osInfo.release,
      arch: osInfo.arch,
    },
    cpu: {
      model: osInfo.cpuModel,
      cores: osInfo.cpuCores,
      speedMHz: osInfo.cpuSpeedMHz,
    },
    memory: {
      totalBytes: osInfo.totalMemoryBytes,
    },
    reactNative,
    git,
    // Web runs record the browser when a browser-driven runner supplies it, and
    // null otherwise (a Node-hosted web sample has no browser). Native runs
    // record the device/build only when an on-device runner supplies it; this
    // host cannot observe a real device, so it stays null and the result is
    // marked deferred rather than fabricated.
    device,
    browser,
  };
}

export { readOsInfo, readGitInfo, readReactNativeVersion };
