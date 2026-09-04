import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ROOT_DIR } from '../component-docs-lib.mjs';
import { installClaimViolations } from '../generate-public-surface-inventory.mjs';
import {
  acknowledgeSurfaceSources,
  gitBlobSha,
  validateAcknowledgedSurfaceSources,
  validateContributorSurfaceDocs,
  extractDocSection,
  CONTRIBUTOR_DOC_HEADING,
  REQUIRED_WORKFLOW_COMMANDS,
  REQUIRED_WORKFLOW_FILES,
  validatePublicSurfaceOwnership,
} from '../check-public-surface-ownership.mjs';

test('acknowledged public-surface source passes only at the reviewed blob', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-surface-owner-'));
  try {
    const relPath = 'surface.ts';
    const initial = 'export const publicThing = 1;\n';
    fs.writeFileSync(path.join(rootDir, relPath), initial);
    const policy = { acknowledgedSourceBlobs: { [relPath]: gitBlobSha(initial) } };

    assert.deepEqual(validateAcknowledgedSurfaceSources(rootDir, policy), []);

    fs.writeFileSync(path.join(rootDir, relPath), 'export const publicThing = 1;\nexport const newPublicThing = 2;\n');
    const violations = validateAcknowledgedSurfaceSources(rootDir, policy);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /changed after documentation ownership was acknowledged/u);
    assert.match(violations[0], /intentionally update acknowledgedSourceBlobs/u);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('surface check is read-only and cannot heal its own drift before validation', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['docs:surface:check'], 'node ./scripts/check-public-surface-ownership.mjs');
  assert.doesNotMatch(pkg.scripts['docs:surface:check'], /docs:surface:generate|generate-public-surface-inventory\.mjs/u);
  // Re-acknowledgement must stay an explicit, separate action.
  assert.doesNotMatch(pkg.scripts['docs:surface:check'], /--acknowledge/u);
  assert.match(pkg.scripts['docs:surface:acknowledge'], /--acknowledge/u);
});

test('release-truth scoping needs the containing section to declare unavailability', () => {
  const available = ['# pkg', '', '## Install', '', '```bash', 'npm install @beemvp/beeui-tokens', '```'].join('\n');
  assert.equal(installClaimViolations('README.md', available).length, 1);

  const acknowledged = [
    '# pkg',
    '',
    '## Distribution state',
    '',
    '**Unpublished:** not published to the public npm registry.',
    '',
    '```bash',
    'npm install @beemvp/beeui-tokens',
    '```',
  ].join('\n');
  assert.deepEqual(installClaimViolations('README.md', acknowledged), []);

  // A later section inherits an earlier file-level unavailability statement...
  const inherited = `${acknowledged}\n\n## Usage\n\n\`\`\`bash\nnpx @beemvp/beeui-cli add button\n\`\`\`\n`;
  assert.deepEqual(installClaimViolations('README.md', inherited), []);

  // ...but unrelated prose near the command does not launder the claim.
  const proximityOnly = [
    '# pkg',
    '',
    '## Install',
    '',
    'We plan a lot of future work on this package and it is not yet slow.',
    'Install it with:',
    '',
    '```bash',
    'npm install @beemvp/beeui-ui',
    '```',
  ].join('\n');
  assert.equal(installClaimViolations('README.md', proximityOnly).length, 1);
});

test('acknowledge tooling rewrites only the recorded blob shas', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-surface-ack-'));
  try {
    fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'surface.ts'), 'export const a = 1;\n');
    const policyPath = path.join(rootDir, 'docs/public-surface-owners.json');
    fs.writeFileSync(policyPath, `${JSON.stringify({ acknowledgedSourceBlobs: { 'surface.ts': 'stale'.padEnd(40, '0') } }, null, 2)}\n`);

    assert.equal(validateAcknowledgedSurfaceSources(rootDir).length, 1);
    assert.deepEqual(acknowledgeSurfaceSources(rootDir), ['surface.ts']);
    assert.deepEqual(validateAcknowledgedSurfaceSources(rootDir), []);
    assert.deepEqual(acknowledgeSurfaceSources(rootDir), []);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

// `docs:surface:acknowledge` makes the staleness error disappear whether or not anything was
// documented, so the only thing standing between a contributor and a silently undocumented
// public surface is a written sequence. An earlier version of this guard only checked that
// whatever the section happened to name still resolved — which passed on a section reduced to
// a single sentence. These drive the guard with synthetic trees; asserting against the real
// CONTRIBUTING.md would pass without the guard existing at all.
function contributorFixture(section) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-contrib-doc-'));
  fs.mkdirSync(path.join(rootDir, 'docs'), { recursive: true });
  for (const file of REQUIRED_WORKFLOW_FILES) fs.writeFileSync(path.join(rootDir, file), '{}\n');
  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    `${JSON.stringify({ scripts: Object.fromEntries(REQUIRED_WORKFLOW_COMMANDS.map((name) => [name, 'x'])) })}\n`,
  );
  fs.writeFileSync(path.join(rootDir, 'CONTRIBUTING.md'), section);
  return rootDir;
}

function goodSection({ commands = REQUIRED_WORKFLOW_COMMANDS, files = REQUIRED_WORKFLOW_FILES } = {}) {
  return [
    CONTRIBUTOR_DOC_HEADING,
    '',
    ...commands.map((name) => `Run \`pnpm ${name}\`.`),
    ...files.map((file) => `Edit \`${file}\`.`),
    '',
    '`pnpm docs:surface:acknowledge` is not the fix for the error it silences.',
    '',
    '## Next section',
    '',
  ].join('\n');
}

function withFixture(section, assertions) {
  const rootDir = contributorFixture(section);
  try {
    assertions(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('the contributor workflow guard accepts a complete section', () => {
  withFixture(goodSection(), (rootDir) => assert.deepEqual(validateContributorSurfaceDocs(rootDir), []));
});

// The attack that defeated the first version of this guard: keep the one sentence it grepped
// for, delete the entire workflow.
test('a section stripped down to the acknowledge warning fails the gate', () => {
  const gutted = [
    CONTRIBUTOR_DOC_HEADING,
    '',
    'Docs are handled elsewhere. `pnpm docs:surface:acknowledge` is not the fix for the error it silences.',
    '',
    '## Next section',
    '',
  ].join('\n');
  withFixture(gutted, (rootDir) => {
    const violations = validateContributorSurfaceDocs(rootDir);
    assert.equal(violations.length, REQUIRED_WORKFLOW_COMMANDS.length - 1 + REQUIRED_WORKFLOW_FILES.length);
    assert.ok(violations.some((v) => v.includes('no longer names `pnpm docs:surface:generate`')));
    assert.ok(violations.some((v) => v.includes('no longer names docs/public-surface-owners.json')));
  });
});

test('dropping any single required step fails the gate', () => {
  // `docs:surface:acknowledge` is the exception: the mandatory warning sentence names it, so a
  // section that drops it from the command list still mentions it and the guard is satisfied.
  // That is the intended behaviour — the warning is what a contributor must not lose.
  for (const omitted of REQUIRED_WORKFLOW_COMMANDS.filter((name) => name !== 'docs:surface:acknowledge')) {
    const section = goodSection({ commands: REQUIRED_WORKFLOW_COMMANDS.filter((name) => name !== omitted) });
    withFixture(section, (rootDir) => {
      const violations = validateContributorSurfaceDocs(rootDir);
      assert.equal(violations.length, 1, `omitting ${omitted} must be reported exactly once`);
      assert.ok(violations[0].includes(`\`pnpm ${omitted}\``), violations[0]);
    });
  }
});

test('dropping any single required control file fails the gate', () => {
  for (const omitted of REQUIRED_WORKFLOW_FILES) {
    const section = goodSection({ files: REQUIRED_WORKFLOW_FILES.filter((file) => file !== omitted) });
    withFixture(section, (rootDir) => {
      const violations = validateContributorSurfaceDocs(rootDir);
      assert.equal(violations.length, 1, `omitting ${omitted} must be reported exactly once`);
      assert.ok(violations[0].includes(`no longer names ${omitted}`), violations[0]);
    });
  }
});

test('a deleted or renamed workflow section fails the gate', () => {
  withFixture('## Something else\n\nNo workflow here.\n', (rootDir) => {
    const violations = validateContributorSurfaceDocs(rootDir);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /has no "## Public documentation surfaces" section/u);
  });
});

// A command name may be split across a line break by a rewrap; the guard flattens whitespace
// before matching so a wrapped `pnpm docs:build` is still validated rather than skipped.
test('a documented command that is not a package script fails the gate, even wrapped', () => {
  const section = goodSection().replace('## Next section', 'Also run `pnpm\ndocs:regenerate` afterwards.\n\n## Next section');
  withFixture(section, (rootDir) => {
    assert.deepEqual(validateContributorSurfaceDocs(rootDir), [
      'CONTRIBUTING.md tells contributors to run `pnpm docs:regenerate`, which is not a package.json script.',
    ]);
  });
});

test('a documented control file that no longer exists fails the gate', () => {
  const section = goodSection().replace('## Next section', 'See `docs/Renamed_Content.json` too.\n\n## Next section');
  withFixture(section, (rootDir) => {
    assert.deepEqual(validateContributorSurfaceDocs(rootDir), [
      'CONTRIBUTING.md references docs/Renamed_Content.json, which does not exist.',
    ]);
  });
});

test('dropping the acknowledge warning fails the gate', () => {
  const section = goodSection().replace('is not the fix for the error it silences.', 'is the final step.');
  withFixture(section, (rootDir) => {
    const violations = validateContributorSurfaceDocs(rootDir);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /must keep warning/u);
  });
});

// A fenced block may open a line with `## `. Slicing the section at the next such line would
// truncate it and hide every later step from the assertions above.
test('a fenced code block containing a markdown heading does not truncate the section', () => {
  const section = goodSection().replace(
    '## Next section',
    '```text\n## not a heading\n```\n\n## Next section',
  );
  withFixture(section, (rootDir) => assert.deepEqual(validateContributorSurfaceDocs(rootDir), []));
  assert.equal(extractDocSection('## A\ntext\n\n## B\nmore\n', '## A'), 'text\n');
});

test('the ownership gate is clean on the current tree', () => {
  assert.deepEqual(validatePublicSurfaceOwnership(ROOT_DIR), []);
});
