// Token lifecycle contract for the canonical BeeUI design-token model.
//
// Lifecycle metadata is part of the canonical token source (packages/tokens/tokens.json);
// there is no separate hand-maintained deprecation registry. Codegen and the machine
// lifecycle manifest are DERIVED from this metadata.
//
// Two alias concepts are intentionally kept distinct:
//   - authoring alias: `$extensions.com.beeui.publicName` maps a DTCG-legal key to its
//     public name (e.g. spacing "2-5" -> "2.5"). It has no deprecation meaning.
//   - deprecated-compatibility alias: a token whose lifecycle status is `deprecated`
//     keeps generating during its compatibility window and points consumers at a
//     replacement when one exists. These are tagged `aliasKind: "deprecated-compatibility"`
//     in output.

const BEEUI_EXTENSION = 'com.beeui';

export const LIFECYCLE_STATUSES = ['stable', 'experimental', 'deprecated'];
export const DEFAULT_LIFECYCLE_STATUS = 'stable';
export const DEPRECATED_ALIAS_KIND = 'deprecated-compatibility';

// Public governed foundation groups, in deterministic output order. `color` (semantic
// colors) is appended after these. focusRing is a compound contract, not a token scale,
// so it is not individually governed.
export const GOVERNED_FOUNDATION_GROUPS = [
  'spacing',
  'radius',
  'fontFamily',
  'fontSize',
  'lineHeight',
  'fontWeight',
  'letterSpacing',
  'controlSize',
  'iconSize',
  'avatarSize',
  'contentWidth',
  'breakpoint',
  'pageGutter',
  'elevation',
  'layer',
  'motionDuration',
  'motionEasing',
];

export const COLOR_CATEGORY = 'color';

function lifecycleError(message) {
  return new Error(`Invalid token lifecycle: ${message}`);
}

function invariant(condition, message) {
  if (!condition) throw lifecycleError(message);
}

function beeExtension(node) {
  return (node && node.$extensions && node.$extensions[BEEUI_EXTENSION]) || {};
}

function publicName(node, rawName) {
  return beeExtension(node).publicName ?? rawName;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function groupTokenEntries(group) {
  if (!isPlainObject(group)) return [];
  return Object.entries(group)
    .filter(([name]) => !name.startsWith('$'))
    .map(([rawName, node]) => [publicName(node, rawName), node, rawName]);
}

function normalizeRemoval(removal, label) {
  if (removal === undefined) return undefined;
  invariant(isPlainObject(removal), `${label}.removal must be an object`);
  if (removal.target !== undefined) {
    invariant(typeof removal.target === 'string' && removal.target.length > 0, `${label}.removal.target must be a non-empty string`);
  }
  if (removal.compatibilitySatisfied !== undefined) {
    invariant(typeof removal.compatibilitySatisfied === 'boolean', `${label}.removal.compatibilitySatisfied must be a boolean`);
  }
  if (removal.migrationEvidence !== undefined) {
    invariant(typeof removal.migrationEvidence === 'string' && removal.migrationEvidence.length > 0, `${label}.removal.migrationEvidence must be a non-empty string`);
  }
  return removal;
}

// Merge the standard DTCG `$deprecated` field with the BeeUI lifecycle extension into a
// single normalized lifecycle descriptor. `$deprecated` (boolean | string) is honored so
// generic DTCG tooling and the BeeUI extension never disagree. The canonical policy's
// defaultStatus is also respected for tokens without an explicit lifecycle status.
export function normalizeLifecycle(
  lifecycleExtension,
  standardDeprecated,
  label,
  defaultStatus = DEFAULT_LIFECYCLE_STATUS,
) {
  const ext = lifecycleExtension ?? {};
  invariant(isPlainObject(ext), `${label}.lifecycle must be an object`);
  invariant(LIFECYCLE_STATUSES.includes(defaultStatus), `${label} default lifecycle status must be one of: ${LIFECYCLE_STATUSES.join(', ')}`);

  const stdDeclared = standardDeprecated !== undefined;
  if (stdDeclared) {
    invariant(
      typeof standardDeprecated === 'boolean' || typeof standardDeprecated === 'string',
      `${label} DTCG $deprecated must be a boolean or string`,
    );
  }
  const stdDeprecated = standardDeprecated === true || typeof standardDeprecated === 'string';
  const stdMessage = typeof standardDeprecated === 'string' ? standardDeprecated : undefined;

  let status = ext.status;
  if (status === undefined) status = stdDeprecated ? 'deprecated' : defaultStatus;
  invariant(LIFECYCLE_STATUSES.includes(status), `${label}.status must be one of: ${LIFECYCLE_STATUSES.join(', ')}`);

  if (stdDeclared) {
    if (standardDeprecated === false) {
      invariant(status !== 'deprecated', `${label} sets DTCG $deprecated=false but lifecycle status is "deprecated"`);
    } else {
      invariant(status === 'deprecated', `${label} sets DTCG $deprecated but lifecycle status is "${status}"`);
    }
  }

  const descriptor = {
    status,
    since: ext.since,
    description: ext.description,
  };

  if (ext.since !== undefined) invariant(typeof ext.since === 'string' && ext.since.length > 0, `${label}.since must be a non-empty string`);
  if (ext.description !== undefined) invariant(typeof ext.description === 'string', `${label}.description must be a string`);

  if (status === 'deprecated') {
    const reason = ext.reason ?? stdMessage;
    invariant(typeof reason === 'string' && reason.length > 0, `${label} is deprecated and must declare a reason`);
    if (stdMessage !== undefined && ext.reason !== undefined) {
      invariant(stdMessage === ext.reason, `${label} DTCG $deprecated message must match the lifecycle reason`);
    }
    const replacement = ext.replacement;
    if (replacement !== undefined) {
      invariant(typeof replacement === 'string' && replacement.length > 0, `${label}.replacement must be a non-empty token path`);
    }
    descriptor.deprecated = {
      reason,
      replacement,
      removal: normalizeRemoval(ext.removal, label),
      compatibilityAlias: ext.compatibilityAlias ?? true,
      aliasKind: DEPRECATED_ALIAS_KIND,
    };
    invariant(typeof descriptor.deprecated.compatibilityAlias === 'boolean', `${label}.compatibilityAlias must be a boolean`);
  } else {
    invariant(ext.reason === undefined && ext.replacement === undefined && ext.removal === undefined, `${label} declares deprecation fields but is not deprecated`);
  }

  return descriptor;
}

function readNodeLifecycle(node, label, defaultStatus) {
  return normalizeLifecycle(beeExtension(node).lifecycle, node?.$deprecated, label, defaultStatus);
}

// Deterministic list of governed public tokens with normalized lifecycle descriptors.
export function collectGovernedTokens(source) {
  invariant(isPlainObject(source), 'canonical source must be an object');
  const meta = beeExtension(source);
  const policy = meta.lifecyclePolicy ?? {};
  const defaultStatus = policy.defaultStatus ?? DEFAULT_LIFECYCLE_STATUS;
  invariant(LIFECYCLE_STATUSES.includes(defaultStatus), 'lifecyclePolicy.defaultStatus must be a known status');
  const tokens = source.tokens ?? {};
  const entries = [];

  for (const group of GOVERNED_FOUNDATION_GROUPS) {
    if (!tokens[group]) continue;
    for (const [name, node] of groupTokenEntries(tokens[group])) {
      const label = `${group}.${name}`;
      entries.push({
        path: `${group}.${name}`,
        category: group,
        name,
        lifecycle: readNodeLifecycle(node, label, defaultStatus),
      });
    }
  }

  const semanticDescriptions = meta.semanticColorDescriptions ?? {};
  const semanticLifecycle = meta.semanticColorLifecycle ?? {};
  invariant(isPlainObject(semanticLifecycle), 'semanticColorLifecycle must be an object');
  for (const name of Object.keys(semanticDescriptions)) {
    const label = `${COLOR_CATEGORY}.${name}`;
    const lifecycle = normalizeLifecycle(semanticLifecycle[name], undefined, label, defaultStatus);
    if (lifecycle.description === undefined && semanticDescriptions[name]) {
      lifecycle.description = semanticDescriptions[name];
    }
    entries.push({ path: `${COLOR_CATEGORY}.${name}`, category: COLOR_CATEGORY, name, lifecycle });
  }

  // Reject lifecycle declared for a semantic color that is not part of the vocabulary.
  for (const name of Object.keys(semanticLifecycle)) {
    invariant(Object.hasOwn(semanticDescriptions, name), `semanticColorLifecycle.${name} does not name a semantic color`);
  }

  return entries;
}

function indexByPath(entries) {
  const map = new Map();
  for (const entry of entries) map.set(entry.path, entry);
  return map;
}

// Resolve a deprecated token's replacement chain, validating category, existence, self
// reference, cycles, and that the chain terminates at a non-deprecated token.
export function resolveReplacementChain(startPath, index) {
  const start = index.get(startPath);
  invariant(start, `${startPath} is not a governed token`);
  const chain = [startPath];
  const visited = new Set([startPath]);
  let current = start;

  while (current.lifecycle.status === 'deprecated') {
    const replacement = current.lifecycle.deprecated.replacement;
    if (replacement === undefined) {
      // A token may be deprecated for pure removal with no replacement, but only as the
      // starting token. Arriving at a deprecated token with no onward replacement by
      // following a replacement edge means the chain dead-ends at a token consumers must
      // not adopt.
      if (current.path === startPath) return { chain, terminal: undefined, resolved: false };
      throw lifecycleError(`${startPath} replacement resolves to deprecated token "${current.path}", which offers no live replacement`);
    }
    invariant(replacement !== current.path, `${current.path} cannot be deprecated in favor of itself`);
    const target = index.get(replacement);
    invariant(target, `${current.path} replacement "${replacement}" does not resolve to a governed token`);
    invariant(target.category === current.category, `${current.path} replacement must stay in category "${current.category}" (got "${target.category}")`);
    invariant(!visited.has(replacement), `replacement chain cycles at ${replacement}`);
    visited.add(replacement);
    chain.push(replacement);
    current = target;
  }

  // A deprecated token's replacement must point directly at a live (non-deprecated) token.
  // Staged migrations that hop through another deprecated token are rejected in pre-1.0.
  invariant(chain.length <= 2, `${startPath} replacement must point at a live token, not a chain through deprecated tokens`);

  return { chain, terminal: current.path, resolved: true };
}

export function validateTokenLifecycle(source) {
  const meta = beeExtension(source);
  const policy = meta.lifecyclePolicy;
  if (policy !== undefined) {
    invariant(isPlainObject(policy), 'lifecyclePolicy must be an object');
    if (policy.statuses !== undefined) {
      invariant(
        Array.isArray(policy.statuses) && LIFECYCLE_STATUSES.every((status) => policy.statuses.includes(status)),
        `lifecyclePolicy.statuses must include: ${LIFECYCLE_STATUSES.join(', ')}`,
      );
    }
    if (policy.defaultStatus !== undefined) {
      invariant(LIFECYCLE_STATUSES.includes(policy.defaultStatus), 'lifecyclePolicy.defaultStatus must be a known status');
    }
  }

  const entries = collectGovernedTokens(source);
  const index = indexByPath(entries);
  for (const entry of entries) {
    if (entry.lifecycle.status === 'deprecated') resolveReplacementChain(entry.path, index);
  }
  return source;
}

// --- removal policy -------------------------------------------------------------------

function parseSemver(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value ?? '');
  if (!match) return undefined;
  return match.slice(1).map(Number);
}

function gte(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

// Whether a deprecated token is allowed to be finally removed. Throws (fails policy) when
// compatibility/migration prerequisites are not satisfied. This is evaluated against the
// pre-removal source where the deprecated token and its lifecycle metadata still exist.
export function assertRemovalAllowed(source, tokenPath, { currentVersion, hasMigrationEvidence = false } = {}) {
  const index = indexByPath(collectGovernedTokens(source));
  const entry = index.get(tokenPath);
  invariant(entry, `${tokenPath} is not a governed token`);
  invariant(entry.lifecycle.status === 'deprecated', `${tokenPath} is not deprecated and cannot be removed under lifecycle policy`);

  const deprecated = entry.lifecycle.deprecated;
  const removal = deprecated.removal ?? {};
  invariant(removal.target, `${tokenPath} cannot be removed before a removal target is declared`);
  // Replacement-less (pure-removal) deprecations are valid. When a replacement exists,
  // it still must resolve cleanly before the deprecated alias can be removed.
  if (deprecated.replacement !== undefined) resolveReplacementChain(tokenPath, index);

  const evidence = hasMigrationEvidence || Boolean(removal.migrationEvidence);
  invariant(evidence, `${tokenPath} cannot be removed without migration evidence`);

  const target = parseSemver(removal.target);
  const current = parseSemver(currentVersion);
  const since = parseSemver(entry.lifecycle.since);
  const windowSatisfied = removal.compatibilitySatisfied === true
    || (target && current && since && gte(current, target)
      && (target[0] > since[0] || target[1] > since[1]));
  invariant(windowSatisfied, `${tokenPath} compatibility window is not satisfied for removal at ${removal.target}`);

  return true;
}

// --- machine manifest + migration report ---------------------------------------------

function categoryOrder(category) {
  const index = GOVERNED_FOUNDATION_GROUPS.indexOf(category);
  return index === -1 ? GOVERNED_FOUNDATION_GROUPS.length : index;
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const byCategory = categoryOrder(a.category) - categoryOrder(b.category);
    if (byCategory !== 0) return byCategory;
    if (a.category !== b.category) return a.category < b.category ? -1 : 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
}

function manifestEntry(entry) {
  const record = {
    path: entry.path,
    category: entry.category,
    status: entry.lifecycle.status,
  };
  if (entry.lifecycle.since) record.since = entry.lifecycle.since;
  if (entry.lifecycle.description) record.description = entry.lifecycle.description;
  if (entry.lifecycle.status === 'deprecated') {
    const deprecated = entry.lifecycle.deprecated;
    record.deprecated = {
      reason: deprecated.reason,
      aliasKind: deprecated.aliasKind,
      compatibilityAlias: deprecated.compatibilityAlias,
    };
    if (deprecated.replacement !== undefined) record.deprecated.replacement = deprecated.replacement;
    if (deprecated.removal?.target) record.deprecated.removalTarget = deprecated.removal.target;
  }
  return record;
}

export function buildLifecycleManifest(source) {
  const meta = beeExtension(source);
  const policy = meta.lifecyclePolicy ?? {};
  const governed = collectGovernedTokens(source);

  const summary = { governed: governed.length, stable: 0, experimental: 0, deprecated: 0 };
  for (const entry of governed) summary[entry.lifecycle.status] += 1;

  const notable = sortEntries(governed.filter((entry) => entry.lifecycle.status !== 'stable')).map(manifestEntry);

  return {
    version: policy.packageVersion ?? null,
    stability: policy.stability ?? null,
    generator: 'scripts/generate-tokens.mjs',
    source: 'packages/tokens/tokens.json',
    statuses: LIFECYCLE_STATUSES,
    aliasKinds: {
      authoring: 'publicName',
      deprecatedCompatibility: DEPRECATED_ALIAS_KIND,
    },
    policy: {
      defaultStatus: policy.defaultStatus ?? DEFAULT_LIFECYCLE_STATUS,
      minimumCompatibilityWindow: policy.minimumCompatibilityWindow ?? null,
      governedScope: policy.governedScope ?? null,
    },
    summary,
    tokens: notable,
  };
}

export function buildMigrationReport(source) {
  const entries = collectGovernedTokens(source);
  const meta = beeExtension(source);
  const policy = meta.lifecyclePolicy ?? {};
  const deprecated = sortEntries(entries.filter((entry) => entry.lifecycle.status === 'deprecated'));
  const experimental = sortEntries(entries.filter((entry) => entry.lifecycle.status === 'experimental'));

  const lines = [
    '# BeeUI token migration report',
    '',
    'Generated from `packages/tokens/tokens.json` by `scripts/generate-tokens.mjs`. Do not edit by hand.',
    '',
    `- Package version: ${policy.packageVersion ?? 'unknown'} (${policy.stability ?? 'pre-1.0'})`,
    `- Deprecated tokens: ${deprecated.length}`,
    `- Experimental tokens: ${experimental.length}`,
    '',
    '## Deprecated tokens',
    '',
  ];

  if (deprecated.length === 0) {
    lines.push('No deprecated tokens. All governed public tokens are stable or experimental.', '');
  } else {
    lines.push('| Token | Category | Replacement | Removal target | Reason |', '| --- | --- | --- | --- | --- |');
    for (const entry of deprecated) {
      const dep = entry.lifecycle.deprecated;
      lines.push(`| \`${entry.path}\` | ${entry.category} | ${dep.replacement ? `\`${dep.replacement}\`` : '—'} | ${dep.removal?.target ?? '—'} | ${dep.reason} |`);
    }
    lines.push('');
  }

  lines.push('## Experimental tokens', '');
  if (experimental.length === 0) {
    lines.push('No experimental tokens.', '');
  } else {
    lines.push('| Token | Category | Since |', '| --- | --- | --- |');
    for (const entry of experimental) {
      lines.push(`| \`${entry.path}\` | ${entry.category} | ${entry.lifecycle.since ?? '—'} |`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}`;
}

// Category -> Map(publicName -> descriptor) for deprecated entries only. Used by codegen
// to emit @deprecated guidance and compatibility aliases. Non-deprecated categories are
// absent so unchanged output stays byte-identical.
export function deprecatedByCategory(source) {
  const map = new Map();
  for (const entry of collectGovernedTokens(source)) {
    if (entry.lifecycle.status !== 'deprecated') continue;
    if (!map.has(entry.category)) map.set(entry.category, new Map());
    map.get(entry.category).set(entry.name, entry.lifecycle.deprecated);
  }
  return map;
}

export function deprecationJsDocMessage(deprecated) {
  const guidance = deprecated.replacement ? `Use \`${deprecated.replacement}\`. ` : '';
  return `${guidance}${deprecated.reason}`.trim();
}
