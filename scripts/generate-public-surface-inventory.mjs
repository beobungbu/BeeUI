#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT_DIR, getPublicComponents } from './component-docs-lib.mjs';
import { readPublicationState } from './public-site-contract-lib.mjs';

export const OWNER_POLICY_FILE = 'docs/public-surface-owners.json';
export const OUTPUT_FILE = 'docs/public-surface.inventory.json';

function readText(relPath, rootDir = ROOT_DIR) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

function readJson(relPath, rootDir = ROOT_DIR) {
  return JSON.parse(readText(relPath, rootDir));
}

function ownerForComponent(name, policy) {
  return policy.owners.uiComponent.replace('{component}', name);
}

function sourceFromPackageExport(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return null;
  if (typeof value.source === 'string') return value.source;
  if (typeof value.default === 'string') return value.default;
  for (const candidate of Object.values(value)) {
    const nested = sourceFromPackageExport(candidate);
    if (nested) return nested;
  }
  return null;
}

export function parseDirectExports(source) {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');
  const values = new Set();
  const types = new Set();
  for (const match of stripped.matchAll(/export\s+(?:declare\s+)?(?:async\s+)?(const|let|var|function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gu)) {
    values.add(match[2]);
  }
  for (const match of stripped.matchAll(/export\s+(?:declare\s+)?(type|interface)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gu)) {
    types.add(match[2]);
  }
  for (const match of stripped.matchAll(/export\s+(type\s+)?\{([\s\S]*?)\}(?:\s+from\s+['"][^'"]+['"])?\s*;/gu)) {
    const blockType = Boolean(match[1]);
    for (const raw of match[2].split(',')) {
      const cleaned = raw.trim();
      if (!cleaned) continue;
      const isType = blockType || cleaned.startsWith('type ');
      const name = cleaned.replace(/^type\s+/u, '').split(/\s+as\s+/u).pop()?.trim();
      if (!name) continue;
      (isType ? types : values).add(name);
    }
  }
  return {
    values: [...values].sort((a, b) => a.localeCompare(b)),
    types: [...types].sort((a, b) => a.localeCompare(b)),
  };
}

function tokenGroups(rootDir = ROOT_DIR) {
  const source = readJson('packages/tokens/tokens.json', rootDir);
  return Object.keys(source.tokens ?? {}).sort((a, b) => a.localeCompare(b));
}

function classifyCoreSymbol(symbol, policy) {
  if (policy.coreClassification.normalConsumer.includes(symbol)) return 'normal-consumer';
  if (policy.coreClassification.advancedConsumerPrefixes.some((prefix) => symbol.toLowerCase().startsWith(prefix.toLowerCase()))) {
    return 'advanced-consumer';
  }
  return policy.coreClassification.default;
}

function packageExportRows(packageDir, policy, rootDir = ROOT_DIR) {
  const manifest = readJson(`${packageDir}/package.json`, rootDir);
  return Object.entries(manifest.exports ?? {})
    .filter(([subpath]) => subpath !== '.')
    .map(([subpath, value]) => {
      let primaryDocsOwner;
      let classification = 'consumer';
      if (packageDir === 'packages/ui' && subpath.startsWith('./')) {
        const component = subpath.slice(2);
        primaryDocsOwner = ownerForComponent(component, policy);
      } else if (packageDir === 'packages/tokens') {
        primaryDocsOwner = policy.tokenStylingSubpaths.includes(subpath)
          ? policy.owners.styling
          : policy.owners.tokens;
        if (policy.machineTokenSubpaths.includes(subpath)) classification = 'machine-readable-public';
      } else {
        primaryDocsOwner = policy.owners.core;
        classification = 'advanced-consumer';
      }
      return {
        id: `${manifest.name}:export:${subpath}`,
        package: manifest.name,
        kind: 'package-export',
        name: subpath,
        source: `${packageDir}/package.json#exports.${subpath}`,
        implementation: sourceFromPackageExport(value),
        classification,
        primaryDocsOwner,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function cliRows(policy, rootDir = ROOT_DIR) {
  const sourcePath = 'packages/cli/src/beeui.mjs';
  const source = readText(sourcePath, rootDir);
  const helpMatch = /const HELP = `([\s\S]*?)`;/u.exec(source);
  if (!helpMatch) throw new Error(`${sourcePath} has no HELP template.`);
  const help = helpMatch[1];
  const commands = new Set();
  const flags = new Set();
  let section = '';
  for (const line of help.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === 'Commands:' || trimmed === 'Add options:' || trimmed === 'Update options:') {
      section = trimmed;
      continue;
    }
    if (!trimmed) continue;
    if (section === 'Commands:') {
      const match = /^([a-z][a-z-]*)(?:\s+[^ ]+)?\s{2,}/u.exec(trimmed);
      if (match) commands.add(match[1]);
    } else if (section.endsWith('options:')) {
      const match = /^(--[a-z][a-z-]*)\s{2,}/u.exec(trimmed);
      if (match) flags.add(match[1]);
    }
  }
  for (const alias of ['--help', '-h', '--version', '-v']) {
    if (source.includes(`command === '${alias}'`)) flags.add(alias);
  }
  const rows = [
    ...[...commands].map((name) => ({ id: `@beemvp/beeui-cli:command:${name}`, kind: 'cli-command', name })),
    ...[...flags].map((name) => ({ id: `@beemvp/beeui-cli:flag:${name}`, kind: 'cli-flag', name })),
  ];
  return rows
    .map((row) => ({
      ...row,
      package: '@beemvp/beeui-cli',
      source: sourcePath,
      classification: 'consumer',
      primaryDocsOwner: policy.owners.cli,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function registryRows(policy, rootDir = ROOT_DIR) {
  const registry = readJson('registry/registry.json', rootDir);
  return registry.items
    .filter((item) => item.public)
    .map((item) => ({
      id: `registry:${item.type}:${item.name}`,
      package: '@beemvp/beeui-cli',
      kind: 'registry-item',
      name: item.name,
      source: 'registry/registry.json',
      classification: item.type === 'component' ? 'consumer' : 'source-ownership-public',
      primaryDocsOwner: item.type === 'component' ? ownerForComponent(item.name, policy) : policy.owners.registry,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function buildPublicSurfaceInventory(rootDir = ROOT_DIR) {
  const policy = readJson(OWNER_POLICY_FILE, rootDir);
  const uiComponents = getPublicComponents(rootDir);
  const rows = [];

  for (const component of uiComponents) {
    for (const name of component.values) {
      rows.push({
        id: `@beemvp/beeui-ui:value:${name}`,
        package: '@beemvp/beeui-ui',
        kind: 'ui-value',
        name,
        family: component.name,
        source: component.source,
        classification: 'consumer',
        primaryDocsOwner: ownerForComponent(component.name, policy),
      });
    }
    for (const name of component.types) {
      rows.push({
        id: `@beemvp/beeui-ui:type:${name}`,
        package: '@beemvp/beeui-ui',
        kind: 'ui-type',
        name,
        family: component.name,
        source: component.source,
        classification: 'consumer-type',
        primaryDocsOwner: ownerForComponent(component.name, policy),
      });
    }
  }

  rows.push(...packageExportRows('packages/ui', policy, rootDir));
  rows.push(...packageExportRows('packages/tokens', policy, rootDir));
  rows.push(...packageExportRows('packages/core', policy, rootDir));

  for (const group of tokenGroups(rootDir)) {
    rows.push({
      id: `@beemvp/beeui-tokens:group:${group}`,
      package: '@beemvp/beeui-tokens',
      kind: 'token-group',
      name: group,
      source: `packages/tokens/tokens.json#tokens.${group}`,
      classification: 'consumer-token',
      primaryDocsOwner: policy.owners.tokens,
    });
  }

  for (const [packageDir, owner, classification] of [
    ['packages/tokens', policy.owners.tokens, 'consumer-runtime'],
    ['packages/core', policy.owners.core, 'advanced-consumer'],
  ]) {
    const pkg = readJson(`${packageDir}/package.json`, rootDir);
    const sourcePath = `${packageDir}/src/index.ts`;
    const exports = parseDirectExports(readText(sourcePath, rootDir));
    for (const name of exports.values) {
      rows.push({
        id: `${pkg.name}:value:${name}`,
        package: pkg.name,
        kind: packageDir === 'packages/core' ? 'core-value' : 'token-runtime-value',
        name,
        source: sourcePath,
        classification: packageDir === 'packages/core' ? classifyCoreSymbol(name, policy) : classification,
        primaryDocsOwner: owner,
      });
    }
    for (const name of exports.types) {
      rows.push({
        id: `${pkg.name}:type:${name}`,
        package: pkg.name,
        kind: packageDir === 'packages/core' ? 'core-type' : 'token-runtime-type',
        name,
        source: sourcePath,
        classification: packageDir === 'packages/core' ? classifyCoreSymbol(name, policy) : 'consumer-runtime-type',
        primaryDocsOwner: owner,
      });
    }
  }

  rows.push(...cliRows(policy, rootDir));
  rows.push(...registryRows(policy, rootDir));

  const byId = new Map();
  for (const row of rows) {
    if (byId.has(row.id)) throw new Error(`duplicate public-surface id ${row.id}`);
    byId.set(row.id, row);
  }

  return {
    schemaVersion: 1,
    generatedFrom: [
      'packages/ui/package.json',
      'packages/ui/src/index.ts',
      'packages/tokens/package.json',
      'packages/tokens/tokens.json',
      'packages/tokens/src/index.ts',
      'packages/core/package.json',
      'packages/core/src/index.ts',
      'packages/cli/src/beeui.mjs',
      'registry/registry.json',
      OWNER_POLICY_FILE,
    ],
    rows: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function releaseTruthViolations(rootDir, policy) {
  const publication = readPublicationState(rootDir);
  if (publication.published) return [];
  const violations = [];
  const installClaim = /(?:^|\n)\s*(?:npm\s+(?:i|install)(?:\s+-g)?|npx)\s+@beemvp\/beeui-[^\s`]+/gu;
  for (const file of policy.releaseTruthReadmes) {
    const source = readText(file, rootDir);
    for (const match of source.matchAll(installClaim)) {
      const before = source.slice(Math.max(0, match.index - 240), match.index).toLowerCase();
      if (!/(unpublished|not published|not yet|future|after publication|once published|target shape)/u.test(before)) {
        violations.push(`${file} presents an install/invoke command as available while publication is closed: ${match[0].trim()}`);
      }
    }
  }
  return violations;
}

export function validatePublicSurfaceInventory(rootDir = ROOT_DIR) {
  const policy = readJson(OWNER_POLICY_FILE, rootDir);
  const inventory = buildPublicSurfaceInventory(rootDir);
  const violations = [];
  for (const row of inventory.rows) {
    if (!row.primaryDocsOwner || !row.primaryDocsOwner.startsWith('/docs/')) {
      violations.push(`${row.id} has no valid primary docs owner.`);
    }
    if (!row.classification) violations.push(`${row.id} has no consumer classification.`);
  }

  const llmsComponents = readText('llms-components.txt', rootDir);
  for (const component of getPublicComponents(rootDir)) {
    if (!llmsComponents.includes(component.name)) {
      violations.push(`machine docs are missing public component ${component.name}.`);
    }
  }

  for (const mirror of policy.requiredMachineMirrors) {
    if (!fs.existsSync(path.join(rootDir, mirror))) violations.push(`required machine mirror ${mirror} is missing.`);
  }

  violations.push(...releaseTruthViolations(rootDir, policy));
  return violations;
}

export function writePublicSurfaceInventory(rootDir = ROOT_DIR) {
  const output = path.join(rootDir, OUTPUT_FILE);
  fs.writeFileSync(output, `${JSON.stringify(buildPublicSurfaceInventory(rootDir), null, 2)}\n`);
  return OUTPUT_FILE;
}

function main() {
  const check = process.argv.includes('--check');
  const violations = validatePublicSurfaceInventory(ROOT_DIR);
  if (violations.length) {
    console.error('Public-surface documentation contract failed:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  if (check) {
    const inventory = buildPublicSurfaceInventory(ROOT_DIR);
    console.log(`Public-surface documentation contract passed (${inventory.rows.length} derived rows, zero orphan owners).`);
    return;
  }
  console.log(`generated ${writePublicSurfaceInventory(ROOT_DIR)}`);
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) main();
