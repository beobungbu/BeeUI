import fs from 'node:fs';

const ORDER_INSENSITIVE_MAP_FIELDS = new Set([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sortObjectKeys(value) {
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]));
}

function canonicalizeOrderInsensitiveField(field, value) {
  if (!isPlainObject(value)) return value;

  const sorted = sortObjectKeys(value);
  if (field !== 'peerDependenciesMeta') return sorted;

  return Object.fromEntries(
    Object.entries(sorted).map(([name, metadata]) => [name, sortObjectKeys(metadata)]),
  );
}

/**
 * Canonicalize only package.json ordering that is semantically irrelevant.
 *
 * Important: nested `exports`, `imports`, `typesVersions`, and all unknown/custom
 * objects are intentionally left untouched. Conditional export/import object order
 * is part of Node/package resolution semantics and must remain observable by the
 * reproducibility gate rather than being hidden by canonicalization.
 */
export function canonicalizePublishManifest(manifest) {
  if (!isPlainObject(manifest)) {
    throw new TypeError('Packed publish manifest must be a JSON object.');
  }

  const canonical = {};
  for (const key of Object.keys(manifest).sort()) {
    const value = manifest[key];
    canonical[key] = ORDER_INSENSITIVE_MAP_FIELDS.has(key)
      ? canonicalizeOrderInsensitiveField(key, value)
      : value;
  }
  return canonical;
}

export function canonicalizePublishManifestText(text) {
  const manifest = JSON.parse(text);
  return `${JSON.stringify(canonicalizePublishManifest(manifest), null, 2)}\n`;
}

export function canonicalizePublishManifestFile(filePath) {
  const before = fs.readFileSync(filePath, 'utf8');
  const after = canonicalizePublishManifestText(before);
  fs.writeFileSync(filePath, after, 'utf8');
  return JSON.parse(after);
}
