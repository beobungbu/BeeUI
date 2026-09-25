// Pure release-state derivation and rendering. No filesystem or network access: every consumer
// (generators, checks, the Starlight release-status component, the Worker build identity) passes
// in already-read data and gets back one of six release states plus renderer-ready text. This is
// the "shared renderer" that replaces the many independently hand-written publication sentences
// across README, the llms.txt family, generated component pages, docs-foundation release-state.json
// and the Starlight release-security/start/guides pages.
//
// Two facts feed the derivation, with independent provenance:
//   - the workspace/candidate version (`packages/ui/package.json`, read by the caller);
//   - a registry observation (`docs/registry-observation.json`, written by `pnpm registry:observe`,
//     read by the caller and passed in as `observation`).
// This module never conflates them: `published`/`state` are always computed from the two, never
// authored directly.

export const RELEASE_STATES = Object.freeze([
  'unpublished',
  'candidate-ahead-of-registry',
  'partial-publication',
  'prerelease-published',
  'stable',
  'registry-inconsistent',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function stableBaseOf(version) {
  return typeof version === 'string' ? version.replace(/-rc\.(0|[1-9][0-9]*)$/, '') : version;
}

function isPrereleaseVersion(version, candidateStableVersion) {
  return version !== candidateStableVersion;
}

// A tag "agrees" across the package set when every package reports the same target for it. This
// is the machine-checkable meaning of "a complete, healthy release line" — the alternative (some
// packages disagree) is exactly what `registry-inconsistent` exists to name instead of hiding.
function agreedDistTag(perPackage, tag) {
  if (perPackage.length === 0) return undefined;
  const targets = perPackage.map((entry) => entry.distTags?.[tag]);
  if (targets.some((value) => !isNonEmptyString(value))) return undefined;
  const [first, ...rest] = targets;
  return rest.every((value) => value === first) ? first : undefined;
}

/**
 * Derive one of the six release states (see RELEASE_STATES) from a workspace version, the policy's
 * stable-line/dist-tag configuration, and a registry observation. Pure function: same input always
 * produces the same output, and it never reaches the network itself.
 *
 * @param {object} input
 * @param {string} input.workspaceVersion - current lockstep version (`packages/ui/package.json`).
 * @param {string} input.candidateStableVersion - the stable base line (e.g. "0.86.2").
 * @param {string} [input.prereleaseDistTag] - defaults to "next".
 * @param {string} [input.stableDistTag] - defaults to "latest".
 * @param {string[]} input.packageNames - canonical ordered list of the four lockstep npm package names.
 * @param {object|null} input.observation - parsed docs/registry-observation.json, or null if never observed.
 */
export function deriveReleaseState({
  workspaceVersion,
  candidateStableVersion,
  prereleaseDistTag = 'next',
  stableDistTag = 'latest',
  packageNames,
  observation,
}) {
  if (!isNonEmptyString(workspaceVersion)) throw new Error('deriveReleaseState requires a non-empty workspaceVersion.');
  if (!isNonEmptyString(candidateStableVersion)) throw new Error('deriveReleaseState requires a non-empty candidateStableVersion.');
  if (!Array.isArray(packageNames) || packageNames.length === 0) {
    throw new Error('deriveReleaseState requires a non-empty packageNames list.');
  }

  const observedAt = observation?.observedAt ?? null;
  const observedBy = observation?.observedBy ?? null;
  const isPrerelease = isPrereleaseVersion(workspaceVersion, candidateStableVersion);

  const base = {
    workspaceVersion,
    candidateStableVersion,
    prereleaseDistTag,
    stableDistTag,
    isPrereleaseWorkspaceVersion: isPrerelease,
    observedAt,
    observedBy,
    perPackage: [],
    observedDistTags: { [prereleaseDistTag]: undefined, [stableDistTag]: undefined },
    installableVersion: null,
    installableDistTag: null,
    published: false,
  };

  if (!observation || typeof observation.packages !== 'object' || observation.packages === null) {
    return { ...base, state: 'unpublished', reason: 'no registry observation has ever been recorded.' };
  }

  const perPackage = packageNames.map((name) => {
    const entry = observation.packages[name];
    return {
      name,
      observed: Boolean(entry),
      versions: Array.isArray(entry?.versions) ? entry.versions : [],
      distTags: entry?.distTags && typeof entry.distTags === 'object' ? entry.distTags : {},
    };
  });

  if (perPackage.some((entry) => !entry.observed)) {
    return {
      ...base,
      perPackage,
      state: 'registry-inconsistent',
      reason: `registry observation is missing an entry for: ${perPackage.filter((e) => !e.observed).map((e) => e.name).join(', ')}.`,
    };
  }

  const nextAgreed = agreedDistTag(perPackage, prereleaseDistTag);
  const stableAgreed = agreedDistTag(perPackage, stableDistTag);
  const observedDistTags = { [prereleaseDistTag]: nextAgreed, [stableDistTag]: stableAgreed };

  const everPublishedAny = perPackage.some((entry) => entry.versions.length > 0);
  if (!everPublishedAny) {
    return { ...base, perPackage, observedDistTags, state: 'unpublished', reason: 'no package in the lockstep group has any published version.' };
  }

  const hasWorkspaceVersion = perPackage.map((entry) => entry.versions.includes(workspaceVersion));
  const allHaveWorkspace = hasWorkspaceVersion.every(Boolean);
  const noneHaveWorkspace = hasWorkspaceVersion.every((v) => !v);

  if (!allHaveWorkspace && !noneHaveWorkspace) {
    const published = perPackage.filter((_, i) => hasWorkspaceVersion[i]).map((e) => e.name);
    const missing = perPackage.filter((_, i) => !hasWorkspaceVersion[i]).map((e) => e.name);
    return {
      ...base,
      perPackage,
      observedDistTags,
      state: 'partial-publication',
      reason: `${published.join(', ')} carry ${workspaceVersion}; ${missing.join(', ')} do not.`,
    };
  }

  if (noneHaveWorkspace) {
    // Registry has *something* published, just not this workspace's version. A "complete" older
    // line is one where every package agrees on at least one persistent dist-tag target.
    if (nextAgreed || stableAgreed) {
      const installableDistTag = nextAgreed ? prereleaseDistTag : stableDistTag;
      return {
        ...base,
        perPackage,
        observedDistTags,
        state: 'candidate-ahead-of-registry',
        reason: `registry still serves ${nextAgreed ?? stableAgreed}; workspace is at ${workspaceVersion}.`,
        installableVersion: nextAgreed ?? stableAgreed,
        installableDistTag,
      };
    }
    return {
      ...base,
      perPackage,
      observedDistTags,
      state: 'registry-inconsistent',
      reason: 'packages have published versions but no dist-tag target agrees across the lockstep group.',
    };
  }

  // allHaveWorkspace: the workspace version is present on every package. Whether that is a
  // *healthy* state still depends on whether the relevant dist-tag actually points at it
  // consistently — presence alone is not the same as "correctly released."
  if (isPrerelease) {
    if (nextAgreed === workspaceVersion) {
      return {
        ...base,
        perPackage,
        observedDistTags,
        state: 'prerelease-published',
        installableVersion: workspaceVersion,
        installableDistTag: prereleaseDistTag,
        published: true,
      };
    }
    return {
      ...base,
      perPackage,
      observedDistTags,
      state: 'registry-inconsistent',
      reason: `${workspaceVersion} is published on every package, but "${prereleaseDistTag}" does not consistently point at it.`,
    };
  }

  if (stableAgreed === workspaceVersion) {
    return {
      ...base,
      perPackage,
      observedDistTags,
      state: 'stable',
      installableVersion: workspaceVersion,
      installableDistTag: stableDistTag,
      published: true,
    };
  }
  return {
    ...base,
    perPackage,
    observedDistTags,
    state: 'registry-inconsistent',
    reason: `${workspaceVersion} is published on every package, but "${stableDistTag}" does not consistently point at it.`,
  };
}

function formatObserved(result) {
  return result.observedAt ? `observed ${result.observedAt}` : 'never observed';
}

/**
 * One-paragraph narrative for the derived state. Markdown-safe (uses backticks for code spans),
 * plain-text callers (llms.txt) can use it verbatim since it contains no HTML/JSX. Every sentence
 * states or repeats the observation time so a reader can judge how fresh the claim is.
 */
export function renderStatusSentence(result) {
  const { workspaceVersion, candidateStableVersion, prereleaseDistTag, stableDistTag } = result;
  switch (result.state) {
    case 'unpublished':
      return (
        `BeeUI has not published any package to npm yet. Workspace version \`${workspaceVersion}\` is an ` +
        `unreleased source candidate, not an installable registry target (${formatObserved(result)}).`
      );
    case 'candidate-ahead-of-registry':
      return (
        `BeeUI \`${workspaceVersion}\` is the current source candidate; it is not yet on npm. The registry ` +
        `still serves \`${result.installableVersion}\` under \`${result.installableDistTag}\` (${formatObserved(result)}). ` +
        `Do not tell consumers \`${workspaceVersion}\` is installable until it is staged, published, and re-observed.`
      );
    case 'partial-publication':
      return (
        `BeeUI \`${workspaceVersion}\` publication is in progress: ${result.reason} This is a partial release, ` +
        `not a complete one. Do not tell consumers \`${workspaceVersion}\` is published until every lockstep ` +
        `package agrees (${formatObserved(result)}).`
      );
    case 'prerelease-published':
      return (
        `BeeUI \`${workspaceVersion}\` is public on npm under the opt-in \`${prereleaseDistTag}\` dist-tag ` +
        `(${formatObserved(result)}). \`${stableDistTag}\` currently resolves to ` +
        `\`${result.observedDistTags[stableDistTag] ?? 'an earlier release'}\` and lags \`${prereleaseDistTag}\` until ` +
        'the owner moves it for all four packages.'
      );
    case 'stable':
      return (
        `BeeUI \`${workspaceVersion}\` is the current stable release, publicly resolvable via \`${stableDistTag}\` ` +
        `(${formatObserved(result)}).`
      );
    case 'registry-inconsistent':
      return (
        `BeeUI's npm registry observation is inconsistent and cannot be summarized as a healthy release state ` +
        `(${result.reason}). Treat public install guidance as unavailable until this is resolved (${formatObserved(result)}).`
      );
    default:
      throw new Error(`renderStatusSentence: unknown release state ${JSON.stringify(result.state)}.`);
  }
}

/** Short machine-readable label, safe for a `STATUS:` line or a badge. */
export function renderStatusLabel(result) {
  return `${result.state} (${result.workspaceVersion}, ${formatObserved(result)})`;
}

/**
 * Serializable props for `ReleaseStatus.astro`. Kept as data (not markdown) so the component can
 * apply its own callout styling instead of parsing rendered text back into structure.
 */
export function toAstroProps(result) {
  return {
    state: result.state,
    headline: renderStatusSentence(result),
    workspaceVersion: result.workspaceVersion,
    installableVersion: result.installableVersion,
    installableDistTag: result.installableDistTag,
    published: result.published,
    observedAt: result.observedAt,
    reason: result.reason ?? null,
  };
}

export function isHealthyPublishedState(state) {
  return state === 'prerelease-published' || state === 'stable';
}

export { stableBaseOf };
