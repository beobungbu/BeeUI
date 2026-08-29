// #145 — regression coverage for the accessibility gate's blocking/allowlist
// behavior itself (not a real axe scan). These tests exercise the pure
// `evaluateViolations`/`isBlocking` logic in `src/a11y-gate.ts` directly, so
// they are load-bearing: reverting the blocking-impact policy, or emptying
// an allowlist entry's rationale, flips these assertions from pass to fail.
// No browser/page fixture is needed — Playwright test files may contain
// plain assertions, and this keeps the regression fast and deterministic.
import { expect, test } from '@playwright/test';
import {
  evaluateViolations,
  isAllowlistEntryValid,
  isBlocking,
  type A11yAllowlistEntry,
  type AxeViolation,
} from '../src/a11y-gate';

function seriousViolation(overrides: Partial<AxeViolation> = {}): AxeViolation {
  return {
    id: 'color-contrast',
    impact: 'serious',
    description: 'Elements must meet minimum color contrast ratio thresholds',
    help: 'Elements must have sufficient color contrast',
    helpUrl: 'https://dequeuniversity.com/rules/axe/color-contrast',
    nodes: [{ target: ['.qa-fixture-button'], html: '<button class="qa-fixture-button">Buy</button>' }],
    ...overrides,
  };
}

test.describe('a11y gate: blocking policy (#145 regression coverage)', () => {
  test('a serious violation with no allowlist entry blocks the gate', () => {
    const evaluation = evaluateViolations('demo-scenario', [seriousViolation()], []);
    expect(isBlocking(evaluation)).toBe(true);
    expect(evaluation.blockingNodes).toHaveLength(1);
  });

  test('a serious violation exempted by a valid, matching allowlist entry does not block', () => {
    const allowlist: A11yAllowlistEntry[] = [
      {
        id: 'color-contrast',
        selector: '.qa-fixture-button',
        scenario: 'demo-scenario',
        reason: 'Confirmed axe false positive: gradient background sampled at a mid-stop below the actual rendered contrast.',
      },
    ];
    const evaluation = evaluateViolations('demo-scenario', [seriousViolation()], allowlist);
    expect(isBlocking(evaluation)).toBe(false);
    expect(evaluation.blockingNodes).toHaveLength(0);
    expect(evaluation.allowlistedNodes).toHaveLength(1);
    expect(evaluation.allowlistedNodes[0].allowlistReason).toContain('Confirmed axe false positive');
  });

  test('emptying the allowlist entry rationale reverts the gate to blocking', () => {
    // Load-bearing: proves the allowlist mechanism cannot be defeated by
    // silently blanking the required rationale while keeping the entry
    // structurally present.
    const allowlistWithEmptyReason: A11yAllowlistEntry[] = [
      {
        id: 'color-contrast',
        selector: '.qa-fixture-button',
        scenario: 'demo-scenario',
        reason: '',
      },
    ];
    expect(isAllowlistEntryValid(allowlistWithEmptyReason[0])).toBe(false);
    const evaluation = evaluateViolations('demo-scenario', [seriousViolation()], allowlistWithEmptyReason);
    expect(isBlocking(evaluation)).toBe(true);
  });

  test('reverting the gate (removing the allowlist entirely) restores blocking for the same violation', () => {
    // Load-bearing: proves the gate is not vacuously green — with the
    // allowlist mechanism absent, the exact same violation that passed above
    // blocks again.
    const evaluation = evaluateViolations('demo-scenario', [seriousViolation()], []);
    expect(isBlocking(evaluation)).toBe(true);
  });

  test('an allowlist entry scoped to a different scenario does not exempt this scenario', () => {
    const allowlist: A11yAllowlistEntry[] = [
      {
        id: 'color-contrast',
        selector: '.qa-fixture-button',
        scenario: 'other-scenario',
        reason: 'Confirmed axe false positive in a different, unrelated scenario fixture.',
      },
    ];
    const evaluation = evaluateViolations('demo-scenario', [seriousViolation()], allowlist);
    expect(isBlocking(evaluation)).toBe(true);
  });

  test('an allowlist entry for a different rule id does not exempt this violation', () => {
    const allowlist: A11yAllowlistEntry[] = [
      {
        id: 'label',
        selector: '.qa-fixture-button',
        reason: 'Unrelated rule id — must not accidentally exempt color-contrast.',
      },
    ];
    const evaluation = evaluateViolations('demo-scenario', [seriousViolation()], allowlist);
    expect(isBlocking(evaluation)).toBe(true);
  });

  test('critical impact is also blocking', () => {
    const evaluation = evaluateViolations(
      'demo-scenario',
      [seriousViolation({ impact: 'critical', id: 'aria-required-attr' })],
      [],
    );
    expect(isBlocking(evaluation)).toBe(true);
  });

  for (const impact of ['minor', 'moderate'] as const) {
    test(`${impact} impact violations are reported but never block`, () => {
      const evaluation = evaluateViolations('demo-scenario', [seriousViolation({ impact })], []);
      expect(isBlocking(evaluation)).toBe(false);
      expect(evaluation.nonBlockingNodes).toHaveLength(1);
      expect(evaluation.blockingNodes).toHaveLength(0);
    });
  }

  test('a null-impact violation is treated as non-blocking (axe only assigns impact to violations, but stay defensive)', () => {
    const evaluation = evaluateViolations('demo-scenario', [seriousViolation({ impact: null })], []);
    expect(isBlocking(evaluation)).toBe(false);
  });

  test('multiple nodes in one violation: only the unallowlisted node blocks', () => {
    const violation = seriousViolation({
      nodes: [
        { target: ['.qa-fixture-a'], html: '<button class="qa-fixture-a">A</button>' },
        { target: ['.qa-fixture-b'], html: '<button class="qa-fixture-b">B</button>' },
      ],
    });
    const allowlist: A11yAllowlistEntry[] = [
      {
        id: 'color-contrast',
        selector: '.qa-fixture-a',
        reason: 'Confirmed axe false positive for the .qa-fixture-a decorative overlay only.',
      },
    ];
    const evaluation = evaluateViolations('demo-scenario', [violation], allowlist);
    expect(isBlocking(evaluation)).toBe(true);
    expect(evaluation.blockingNodes.map((node) => node.target)).toEqual(['.qa-fixture-b']);
    expect(evaluation.allowlistedNodes.map((node) => node.target)).toEqual(['.qa-fixture-a']);
  });
});
