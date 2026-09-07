import {
  COVERAGE_RATIONALE,
  componentExamples,
  patternExamples,
  resolveShowcaseTarget,
  showcaseExampleRegistry,
} from '../example-registry';
import {
  parseShowcaseTarget,
  sameShowcaseTarget,
  serializeShowcaseTarget,
  showcaseHref,
} from '../showcase-target';

describe('Showcase public target contract', () => {
  it('round-trips canonical component identity deterministically', () => {
    const target = { surface: 'component' as const, id: 'select', example: 'basic', theme: 'dark' };
    const search = serializeShowcaseTarget(target);
    expect(search).toBe('?surface=component&id=select&example=basic&theme=dark');
    expect(parseShowcaseTarget(search)).toEqual(target);
    expect(showcaseHref(target)).toBe('/showcase/?surface=component&id=select&example=basic&theme=dark');
  });

  it('upgrades the pre-#472 component query to canonical identity', () => {
    expect(parseShowcaseTarget('?component=button')).toEqual({
      surface: 'component',
      id: 'button',
      example: 'basic',
    });
  });

  it('rejects query strings without a public surface/id pair', () => {
    expect(parseShowcaseTarget('?surface=component')).toBeNull();
    expect(parseShowcaseTarget('?surface=unknown&id=button')).toBeNull();
  });

  it('resolves exact component examples and returns explicit stale-example recovery', () => {
    const uncontrolled = resolveShowcaseTarget({ surface: 'component', id: 'select', example: 'uncontrolled' });
    expect(uncontrolled.ok).toBe(true);
    if (uncontrolled.ok) {
      expect(uncontrolled.example?.sourcePath).toContain('select-showcase.tsx');
      expect(uncontrolled.example?.focusTestId).toBe('select-showcase-placeholder-trigger');
      expect(uncontrolled.example?.coverageClasses).toEqual(['uncontrolled']);
    }

    const stale = resolveShowcaseTarget({ surface: 'component', id: 'select', example: 'removed' });
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.reason).toContain('no longer exists');
      expect(stale.recoveryTarget).toEqual({ surface: 'component', id: 'select', example: 'basic' });
    }
  });

  it('resolves pattern state and rejects stale named states without falling back silently', () => {
    const example = patternExamples.find((entry) => (entry.stateIds?.length ?? 0) > 1);
    expect(example).toBeTruthy();
    if (!example) return;

    const validState = example.stateIds?.[0];
    expect(validState).toBeTruthy();
    const ok = resolveShowcaseTarget({ surface: 'pattern', id: example.ownerId, state: validState });
    expect(ok.ok).toBe(true);

    const stale = resolveShowcaseTarget({ surface: 'pattern', id: example.ownerId, state: 'state-that-does-not-exist' });
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.reason).toContain('no longer exists');
      expect(stale.recoveryTarget?.surface).toBe('pattern');
    }
  });

  it('maintains one basic example for every component and one addressable row for every applicable class', () => {
    const basicExamples = componentExamples.filter((entry) => entry.id === 'basic');
    expect(basicExamples.length).toBeGreaterThan(50);
    expect(new Set(basicExamples.map((entry) => entry.ownerId)).size).toBe(basicExamples.length);

    for (const basic of basicExamples) {
      expect(basic.coverageClasses).toEqual(['basic']);
      expect(basic.sourcePath).toMatch(/^apps\/showcase\//);
      expect(basic.showcaseTarget).toEqual({ surface: 'component', id: basic.ownerId, example: 'basic' });

      for (const coverageClass of basic.applicableCoverageClasses ?? []) {
        const addressable = componentExamples.find(
          (entry) => entry.ownerId === basic.ownerId && entry.id === coverageClass,
        );
        expect(addressable).toBeTruthy();
        expect(addressable?.coverageClasses).toEqual([coverageClass]);
        expect(addressable?.showcaseTarget).toEqual({
          surface: 'component',
          id: basic.ownerId,
          example: coverageClass,
        });
      }
    }
  });

  it('gives every claimed coverage class its own addressable target', () => {
    const byOwner = new Map<string, typeof componentExamples[number][]>();
    for (const entry of componentExamples) {
      const rows = byOwner.get(entry.ownerId) ?? [];
      rows.push(entry);
      byOwner.set(entry.ownerId, rows);
    }

    const collapsed: string[] = [];
    for (const [ownerId, rows] of byOwner) {
      const targets = new Set(
        rows.map((row) => `${row.sourcePath}|${row.focusTestId ?? ''}|${row.focusText ?? ''}`),
      );
      if (targets.size !== rows.length) {
        collapsed.push(`${ownerId}: ${rows.length} classes share ${targets.size} target(s)`);
      }
      for (const row of rows) {
        expect(Boolean(row.focusTestId || row.focusText)).toBe(true);
      }
    }

    // A claimed class that resolves to the same element as another class proves nothing:
    // both URLs open the identical view. #472 forbids satisfying coverage that way.
    expect(collapsed).toEqual([]);
  });

  it('states a reviewable rationale for every complex component that stops at one example', () => {
    const COMPLEX_REVIEW_SET = [
      'alert-dialog', 'calendar', 'checkbox', 'date-picker', 'date-time-picker', 'dialog',
      'dropdown-menu', 'field', 'input', 'otp-input', 'pagination', 'password-input', 'popover',
      'radio', 'select', 'sheet', 'switch', 'table', 'tabs', 'toast', 'tooltip',
    ];

    for (const ownerId of COMPLEX_REVIEW_SET) {
      const rows = componentExamples.filter((entry) => entry.ownerId === ownerId);
      expect(rows.length).toBeGreaterThan(0);
      if (rows.length === 1) {
        expect(typeof COVERAGE_RATIONALE[ownerId]).toBe('string');
        expect(COVERAGE_RATIONALE[ownerId].length).toBeGreaterThan(20);
      }
    }

    for (const ownerId of Object.keys(COVERAGE_RATIONALE)) {
      expect(COMPLEX_REVIEW_SET).toContain(ownerId);
    }
  });

  it('does not let one basic row masquerade as complex coverage', () => {
    const selectRows = componentExamples.filter((entry) => entry.ownerId === 'select');
    const ids = new Set(selectRows.map((entry) => entry.id));
    for (const required of ['basic', 'states', 'uncontrolled', 'composition']) {
      expect(ids.has(required)).toBe(true);
    }
    expect(selectRows.find((entry) => entry.id === 'basic')?.coverageClasses).toEqual(['basic']);
    expect(new Set(selectRows.map((entry) => entry.focusTestId)).size).toBe(selectRows.length);
  });

  it('gives every registry row a resolvable, uniquely named screenshot target', () => {
    const names = new Set<string>();

    for (const entry of showcaseExampleRegistry) {
      const screenshot = entry.screenshotTarget;
      if (!screenshot) {
        // Fixture rows are native-only acceptance surfaces with no Web screenshot lane.
        expect(entry.ownerType).toBe('fixture');
        continue;
      }

      expect(names.has(screenshot.name)).toBe(false);
      names.add(screenshot.name);

      // A screenshot whose target no longer resolves is exactly the silent drift #472
      // section 13 requires CI to fail on.
      const resolved = resolveShowcaseTarget(screenshot.target);
      expect(resolved.ok).toBe(true);
      expect(serializeShowcaseTarget(screenshot.target)).toBe(
        serializeShowcaseTarget(entry.showcaseTarget.state || entry.ownerType === 'pattern'
          ? { ...entry.showcaseTarget, state: screenshot.target.state }
          : entry.showcaseTarget),
      );
    }
  });

  it('maps every component with real pattern composition to resolvable production targets', () => {
    const basics = componentExamples.filter((entry) => entry.id === 'basic');
    const mapped = basics.filter((entry) => (entry.productionTargets?.length ?? 0) > 0);

    expect(mapped.length).toBeGreaterThan(20);
    for (const entry of mapped) {
      for (const target of entry.productionTargets ?? []) {
        expect(target.surface).toBe('pattern');
        expect(resolveShowcaseTarget(target).ok).toBe(true);
      }
    }
  });

  it('uses stable unique owner/example/state identities across the registry', () => {
    const keys = showcaseExampleRegistry.map((entry) => [
      entry.ownerType,
      entry.ownerId,
      entry.id,
      entry.showcaseTarget.state ?? '',
    ].join(':'));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('compares targets by canonical serialization, not object identity', () => {
    expect(sameShowcaseTarget(
      { surface: 'component', id: 'button', example: 'basic' },
      { surface: 'component', id: 'button', example: 'basic' },
    )).toBe(true);
    expect(sameShowcaseTarget(
      { surface: 'component', id: 'button', example: 'basic' },
      { surface: 'component', id: 'button', example: 'states' },
    )).toBe(false);
  });
});
