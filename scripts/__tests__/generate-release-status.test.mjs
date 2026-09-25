import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildReleaseStatusOutputs, RELEASE_STATUS_TARGETS, renderReleaseStatusBlock } from '../generate-release-status.mjs';
import { ROOT_DIR } from '../public-site-contract-lib.mjs';

test('every release-status target file exists and carries exactly one marker block', () => {
  for (const relative of RELEASE_STATUS_TARGETS) {
    const absolute = path.join(ROOT_DIR, relative);
    assert.ok(fs.existsSync(absolute), `${relative} must exist`);
    const text = fs.readFileSync(absolute, 'utf8');
    const starts = text.split('release-status:generated:start').length - 1;
    const ends = text.split('release-status:generated:end').length - 1;
    assert.equal(starts, 1, `${relative} must carry exactly one release-status:generated:start marker`);
    assert.equal(ends, 1, `${relative} must carry exactly one release-status:generated:end marker`);
  }
});

test('buildReleaseStatusOutputs renders the same sentence into every target', () => {
  const outputs = buildReleaseStatusOutputs(ROOT_DIR);
  const text = renderReleaseStatusBlock(ROOT_DIR);
  assert.equal(outputs.length, RELEASE_STATUS_TARGETS.length);
  for (const output of outputs) {
    assert.ok(output.next.includes(text), `${output.relativePath} must contain the rendered status sentence`);
  }
});

test('buildReleaseStatusOutputs throws an actionable error when a target is missing its marker block', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beeui-release-status-'));
  try {
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'packages/ui'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'packages/ui/package.json'), JSON.stringify({ version: '0.86.2-rc.1' }));
    fs.writeFileSync(
      path.join(dir, 'docs/dist-tag-policy.md'),
      '```json dist-tag-policy\n{"candidateStableVersion":"0.86.2","distTags":["latest","next"],"prereleaseDistTag":"next","stableDistTag":"latest","stablePromotionTag":"latest","lockstepPackages":[],"releaseEnvironment":"release"}\n```\n',
    );
    fs.writeFileSync(path.join(dir, 'README.md'), '# no marker here\n');
    fs.writeFileSync(path.join(dir, 'docs/consumer-compatibility-report.md'), '# no marker here either\n');
    assert.throws(() => buildReleaseStatusOutputs(dir), /missing its release-status:generated marker block/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
