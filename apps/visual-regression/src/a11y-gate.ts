// #145 — Web accessibility audit gate: deterministic, framework-agnostic
// evaluation of axe-core violation output against a narrow allowlist.
//
// This module intentionally has no dependency on Playwright or axe-core's
// runtime so it can be exercised by fast, load-bearing regression tests
// (tests/a11y-gate.spec.ts) without a browser. The real axe scan
// (tests/a11y.spec.ts) feeds its raw `violations` array straight into
// `evaluateViolations`.

/** Minimal shape of an axe-core violation node, trimmed to what the gate needs. */
export type AxeResultNode = {
  target: string[];
  html: string;
  failureSummary?: string;
};

/** axe-core's own `Result.impact` type also allows `undefined`; the gate treats that identically to `null` (non-blocking). */
export type AxeImpact = 'minor' | 'moderate' | 'serious' | 'critical' | null | undefined;

/** Minimal shape of an axe-core violation, trimmed to what the gate needs. */
export type AxeViolation = {
  id: string;
  impact?: AxeImpact;
  description: string;
  help: string;
  helpUrl: string;
  nodes: AxeResultNode[];
};

/**
 * One allowlist entry narrowly exempts a single axe rule violation on a
 * single DOM target (optionally scoped to one scenario) from blocking CI.
 *
 * `reason` is mandatory and must be a real rationale (not a placeholder) —
 * `isAllowlistEntryValid` enforces a minimum length so an emptied or
 * near-empty rationale silently stops exempting the violation instead of
 * silently continuing to pass CI.
 */
export type A11yAllowlistEntry = {
  /** axe-core rule id, e.g. "color-contrast". */
  id: string;
  /** Exact target selector path as axe reports it (`node.target.join(' ')`). */
  selector: string;
  /** Optional scenario name to scope the exemption narrowly; omit to apply across scenarios. */
  scenario?: string;
  /** Mandatory, non-empty rationale for why this is an unavoidable platform/tool false positive. */
  reason: string;
};

export type ViolationNodeRecord = {
  scenario: string;
  ruleId: string;
  impact: AxeImpact;
  target: string;
  html: string;
  help: string;
  helpUrl: string;
  allowlisted: boolean;
  allowlistReason?: string;
};

export type GateEvaluation = {
  scenario: string;
  /** Serious/critical nodes with no valid matching allowlist entry — these fail the gate. */
  blockingNodes: ViolationNodeRecord[];
  /** Serious/critical nodes exempted by a valid, narrow allowlist entry. */
  allowlistedNodes: ViolationNodeRecord[];
  /** Minor/moderate nodes — always reported, never block by themselves. */
  nonBlockingNodes: ViolationNodeRecord[];
  /** Every violation node seen, regardless of category. */
  allViolationNodes: ViolationNodeRecord[];
};

const BLOCKING_IMPACTS: ReadonlySet<AxeViolation['impact']> = new Set(['serious', 'critical']);

/** Minimum rationale length that counts as a real explanation rather than a placeholder. */
const MIN_REASON_LENGTH = 10;

/**
 * An allowlist entry only exempts a violation when it carries a real,
 * non-placeholder rationale. Blanket/empty-reason entries are rejected here
 * so "empty the rationale" is equivalent to "delete the entry" for gate
 * purposes — this is what makes the allowlist mechanism load-bearing rather
 * than decorative.
 */
export function isAllowlistEntryValid(entry: A11yAllowlistEntry): boolean {
  return typeof entry.reason === 'string' && entry.reason.trim().length >= MIN_REASON_LENGTH;
}

function matchesEntry(
  node: { ruleId: string; target: string; scenario: string },
  entry: A11yAllowlistEntry,
): boolean {
  if (!isAllowlistEntryValid(entry)) return false;
  if (entry.id !== node.ruleId) return false;
  if (entry.selector !== node.target) return false;
  if (entry.scenario && entry.scenario !== node.scenario) return false;
  return true;
}

/**
 * Evaluate one scenario's raw axe violations against the allowlist.
 *
 * Blocking policy (#145 DoD): any node from a `serious`/`critical` violation
 * blocks CI unless a valid, narrow allowlist entry exempts that exact
 * rule+target(+scenario). `minor`/`moderate` violations are surfaced for
 * visibility but never block on their own.
 */
export function evaluateViolations(
  scenario: string,
  violations: readonly AxeViolation[],
  allowlist: readonly A11yAllowlistEntry[],
): GateEvaluation {
  const blockingNodes: ViolationNodeRecord[] = [];
  const allowlistedNodes: ViolationNodeRecord[] = [];
  const nonBlockingNodes: ViolationNodeRecord[] = [];
  const allViolationNodes: ViolationNodeRecord[] = [];

  for (const violation of violations) {
    const isBlockingImpact = violation.impact !== null && BLOCKING_IMPACTS.has(violation.impact);

    for (const node of violation.nodes) {
      const target = node.target.join(' ');
      const record: ViolationNodeRecord = {
        scenario,
        ruleId: violation.id,
        impact: violation.impact,
        target,
        html: node.html,
        help: violation.help,
        helpUrl: violation.helpUrl,
        allowlisted: false,
      };
      allViolationNodes.push(record);

      if (!isBlockingImpact) {
        nonBlockingNodes.push(record);
        continue;
      }

      const matchedEntry = allowlist.find((entry) =>
        matchesEntry({ ruleId: violation.id, target, scenario }, entry),
      );
      if (matchedEntry) {
        record.allowlisted = true;
        record.allowlistReason = matchedEntry.reason;
        allowlistedNodes.push(record);
      } else {
        blockingNodes.push(record);
      }
    }
  }

  return { scenario, blockingNodes, allowlistedNodes, nonBlockingNodes, allViolationNodes };
}

function normalizeTarget(target: unknown): string[] {
  if (Array.isArray(target)) {
    return target.map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)));
  }
  if (typeof target === 'string') return [target];
  return [JSON.stringify(target)];
}

/**
 * Translates axe-core's own richer `Result[]` shape (which supports
 * shadow-DOM/cross-frame selector targets we don't need) into this module's
 * minimal `AxeViolation[]`. Kept as the one translation boundary so
 * `evaluateViolations`/`isBlocking` stay fully decoupled from axe-core's
 * types and can be unit-tested without importing axe-core at all.
 */
export function normalizeAxeViolations(rawViolations: readonly unknown[]): AxeViolation[] {
  return rawViolations.map((raw) => {
    const violation = raw as {
      id: string;
      impact?: string | null;
      description: string;
      help: string;
      helpUrl: string;
      nodes: ReadonlyArray<{ target: unknown; html: string; failureSummary?: string }>;
    };
    return {
      id: violation.id,
      impact: (violation.impact ?? null) as AxeImpact,
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodes: violation.nodes.map((node) => ({
        target: normalizeTarget(node.target),
        html: node.html,
        failureSummary: node.failureSummary,
      })),
    };
  });
}

/** A scenario's gate fails whenever any unexempted serious/critical node remains. */
export function isBlocking(evaluation: GateEvaluation): boolean {
  return evaluation.blockingNodes.length > 0;
}

/** Aggregate blocking state across every scenario evaluated in a run. */
export function anyBlocking(evaluations: readonly GateEvaluation[]): boolean {
  return evaluations.some(isBlocking);
}
