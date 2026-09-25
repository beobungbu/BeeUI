import assert from 'node:assert/strict';
import test from 'node:test';

import { collectLiteralAuditViolations } from '../release/literal-audit.mjs';
import { ROOT_DIR } from '../public-site-contract-lib.mjs';

function fakeGrep(lines) {
  return () => lines.map((line) => `${line}\n`).join('');
}

test('a literal in CHANGELOG.md is allowed as history', () => {
  const { violations, allowed } = collectLiteralAuditViolations(
    ROOT_DIR,
    '9.9.9-rc.1',
    fakeGrep(['CHANGELOG.md:9:## [9.9.9-rc.1]']),
  );
  assert.deepEqual(violations, []);
  assert.equal(allowed.length, 1);
});

test('a literal in a manifest is allowed as the authored source', () => {
  const { violations } = collectLiteralAuditViolations(
    ROOT_DIR,
    '9.9.9-rc.1',
    fakeGrep(['packages/ui/package.json:3:  "version": "9.9.9-rc.1"']),
  );
  assert.deepEqual(violations, []);
});

test('a literal in a generated component page is allowed', () => {
  const { violations } = collectLiteralAuditViolations(
    ROOT_DIR,
    '9.9.9-rc.1',
    fakeGrep(['apps/docs/src/content/docs/components/button.md:5:is public on npm at 9.9.9-rc.1']),
  );
  assert.deepEqual(violations, []);
});

test('a literal in a test fixture is allowed', () => {
  const { violations } = collectLiteralAuditViolations(
    ROOT_DIR,
    '9.9.9-rc.1',
    fakeGrep(['scripts/__tests__/example.test.mjs:12:const version = "9.9.9-rc.1";']),
  );
  assert.deepEqual(violations, []);
});

test('a literal in an unrecognized hand-maintained file is a violation', () => {
  const { violations } = collectLiteralAuditViolations(
    ROOT_DIR,
    '9.9.9-rc.1',
    fakeGrep(['docs/some-new-hand-written-doc.md:1:BeeUI 9.9.9-rc.1 is publicly published.']),
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0], /some-new-hand-written-doc/);
});

test('a git-grep "no matches" exit is treated as zero hits, not an error', () => {
  const noMatch = () => {
    const error = new Error('no matches');
    error.status = 1;
    throw error;
  };
  const result = collectLiteralAuditViolations(ROOT_DIR, '9.9.9-rc.1', noMatch);
  assert.deepEqual(result, { total: 0, violations: [], allowed: [] });
});

test('a real git-grep error (not "no matches") propagates', () => {
  const failing = () => {
    const error = new Error('fatal: not a git repository');
    error.status = 128;
    throw error;
  };
  assert.throws(() => collectLiteralAuditViolations(ROOT_DIR, '9.9.9-rc.1', failing), /not a git repository/);
});

test('the real repository currently has zero literal-audit violations for the workspace version', () => {
  const { violations } = collectLiteralAuditViolations(ROOT_DIR);
  assert.deepEqual(violations, [], violations.join('\n'));
});
