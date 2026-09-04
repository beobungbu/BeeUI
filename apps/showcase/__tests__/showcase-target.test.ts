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
    const ok = resolveShowcaseTarget({ surface: 'component', id: 'select', example: 'basic' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.example?.sourcePath).toContain('select-showcase.tsx');

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

  it('maintains one basic example identity for every registered component owner', () => {
    expect(componentExamples.length).toBeGreaterThan(50);
    expect(new Set(componentExamples.map((entry) => entry.ownerId)).size).toBe(componentExamples.length);
    for (const entry of componentExamples) {
      expect(entry.id).toBe('basic');
      expect(entry.coverageClasses).toContain('basic');
      expect(entry.sourcePath).toMatch(/^apps\/showcase\//);
      expect(entry.showcaseTarget).toEqual({ surface: 'component', id: entry.ownerId, example: 'basic' });
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
