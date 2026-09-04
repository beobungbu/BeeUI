import {
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
    const controlled = resolveShowcaseTarget({ surface: 'component', id: 'select', example: 'controlled' });
    expect(controlled.ok).toBe(true);
    if (controlled.ok) {
      expect(controlled.example?.sourcePath).toContain('select-showcase.tsx');
      expect(controlled.example?.focusTestId).toBe('select-showcase-controlled-trigger');
      expect(controlled.example?.coverageClasses).toEqual(['controlled']);
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
      expect(basic.focusTestId || basic.focusText).toBeTruthy();

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

  it('does not let one basic row masquerade as complex coverage', () => {
    const selectRows = componentExamples.filter((entry) => entry.ownerId === 'select');
    const ids = new Set(selectRows.map((entry) => entry.id));
    for (const required of ['basic', 'states', 'controlled', 'uncontrolled', 'composition', 'accessibility']) {
      expect(ids.has(required)).toBe(true);
    }
    expect(selectRows.find((entry) => entry.id === 'basic')?.coverageClasses).toEqual(['basic']);
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
