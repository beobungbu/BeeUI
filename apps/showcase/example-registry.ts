import { defaultPatternState, findPatternDomain, findPatternScreen, patternCatalog } from './pattern-gallery/pattern-catalog';
import type { ShowcaseTarget } from './showcase-target';

export type ShowcasePlatform = 'web' | 'ios' | 'android';
export type ExampleCoverageClass =
  | 'basic'
  | 'variants'
  | 'states'
  | 'controlled'
  | 'uncontrolled'
  | 'composition'
  | 'accessibility'
  | 'platform'
  | 'production';

export type ShowcaseExample = {
  id: string;
  ownerType: 'component' | 'pattern' | 'fixture';
  ownerId: string;
  title: string;
  intent: string;
  sourcePath: string;
  platform: readonly ShowcasePlatform[];
  expectedResult: string;
  showcaseTarget: ShowcaseTarget;
  coverageClasses: readonly ExampleCoverageClass[];
  stateIds?: readonly string[];
  docsRoute?: string;
};

const MAIN_GALLERY = 'apps/showcase/component-gallery/component-gallery.tsx';
const PUBLIC_DOC_FIXTURES = 'apps/showcase/component-gallery/public-doc-fixtures.tsx';

const COMPONENT_FIXTURES: readonly [string, string][] = [
  ['accordion', MAIN_GALLERY],
  ['alert-banner', MAIN_GALLERY],
  ['alert-dialog', MAIN_GALLERY],
  ['app-header', MAIN_GALLERY],
  ['avatar', MAIN_GALLERY],
  ['badge', MAIN_GALLERY],
  ['bottom-action-bar', MAIN_GALLERY],
  ['box', MAIN_GALLERY],
  ['breadcrumb', MAIN_GALLERY],
  ['button', MAIN_GALLERY],
  ['calendar', PUBLIC_DOC_FIXTURES],
  ['card', MAIN_GALLERY],
  ['checkbox', MAIN_GALLERY],
  ['chip', MAIN_GALLERY],
  ['collapsible', MAIN_GALLERY],
  ['date-picker', 'apps/showcase/component-gallery/date-picker-showcase.tsx'],
  ['date-time-picker', 'apps/showcase/component-gallery/date-time-picker-showcase.tsx'],
  ['description-list', MAIN_GALLERY],
  ['dialog', MAIN_GALLERY],
  ['dropdown-menu', MAIN_GALLERY],
  ['field', MAIN_GALLERY],
  ['form-group', MAIN_GALLERY],
  ['form-message', PUBLIC_DOC_FIXTURES],
  ['icon-button', MAIN_GALLERY],
  ['input', MAIN_GALLERY],
  ['keyboard-aware-screen', MAIN_GALLERY],
  ['label', PUBLIC_DOC_FIXTURES],
  ['link', MAIN_GALLERY],
  ['list-group', MAIN_GALLERY],
  ['list-item', MAIN_GALLERY],
  ['metadata-row', PUBLIC_DOC_FIXTURES],
  ['otp-input', MAIN_GALLERY],
  ['pagination', MAIN_GALLERY],
  ['password-input', MAIN_GALLERY],
  ['popover', MAIN_GALLERY],
  ['progress', MAIN_GALLERY],
  ['radio', MAIN_GALLERY],
  ['safe-area', MAIN_GALLERY],
  ['screen', MAIN_GALLERY],
  ['search-input', MAIN_GALLERY],
  ['section', MAIN_GALLERY],
  ['segmented-control', MAIN_GALLERY],
  ['select', 'apps/showcase/component-gallery/select-showcase.tsx'],
  ['separator', MAIN_GALLERY],
  ['sheet', MAIN_GALLERY],
  ['skeleton', MAIN_GALLERY],
  ['spinner', MAIN_GALLERY],
  ['stack', MAIN_GALLERY],
  ['stat', MAIN_GALLERY],
  ['state-message', MAIN_GALLERY],
  ['stepper', MAIN_GALLERY],
  ['switch', MAIN_GALLERY],
  ['table', 'apps/showcase/component-gallery/table-showcase.tsx'],
  ['tabs', MAIN_GALLERY],
  ['text', MAIN_GALLERY],
  ['textarea', MAIN_GALLERY],
  ['theme-scope', MAIN_GALLERY],
  ['timeline', MAIN_GALLERY],
  ['toast', MAIN_GALLERY],
  ['tooltip', MAIN_GALLERY],
  ['use-bee-token', PUBLIC_DOC_FIXTURES],
  ['visually-hidden', PUBLIC_DOC_FIXTURES],
];

const COMPLEX_COMPONENTS = new Set([
  'alert-dialog',
  'calendar',
  'checkbox',
  'date-picker',
  'date-time-picker',
  'dialog',
  'dropdown-menu',
  'field',
  'input',
  'otp-input',
  'pagination',
  'password-input',
  'popover',
  'radio',
  'select',
  'sheet',
  'switch',
  'table',
  'tabs',
  'toast',
  'tooltip',
]);

const PLATFORM_SPLIT_COMPONENTS = new Set(['date-picker', 'date-time-picker', 'sheet', 'table', 'tooltip']);
const PRODUCTION_LINKED_COMPONENTS = new Set(['button', 'card', 'field', 'input', 'select', 'table', 'tabs', 'text']);

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .map((part) => part === 'otp' ? 'OTP' : part === 'bee' ? 'Bee' : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function coverageForComponent(ownerId: string): readonly ExampleCoverageClass[] {
  const coverage = new Set<ExampleCoverageClass>(['basic']);
  if (COMPLEX_COMPONENTS.has(ownerId)) {
    coverage.add('states');
    coverage.add('accessibility');
  }
  if (['checkbox', 'field', 'input', 'otp-input', 'pagination', 'radio', 'select', 'switch', 'tabs'].includes(ownerId)) {
    coverage.add('controlled');
  }
  if (['dialog', 'popover', 'select', 'sheet', 'tooltip'].includes(ownerId)) coverage.add('uncontrolled');
  if (['alert-dialog', 'dialog', 'dropdown-menu', 'field', 'popover', 'select', 'sheet', 'tabs'].includes(ownerId)) {
    coverage.add('composition');
  }
  if (['button', 'badge', 'spinner'].includes(ownerId)) coverage.add('variants');
  if (PLATFORM_SPLIT_COMPONENTS.has(ownerId)) coverage.add('platform');
  if (PRODUCTION_LINKED_COMPONENTS.has(ownerId)) coverage.add('production');
  return [...coverage];
}

export const componentExamples: readonly ShowcaseExample[] = COMPONENT_FIXTURES.map(([ownerId, sourcePath]) => ({
  id: 'basic',
  ownerType: 'component',
  ownerId,
  title: `${titleFromSlug(ownerId)} · basic`,
  intent: `Inspect the canonical executable ${titleFromSlug(ownerId)} usage selected by BeeUI's public component preview contract.`,
  sourcePath,
  platform: ['web', 'ios', 'android'] as const,
  expectedResult: `Showcase opens Components with ${titleFromSlug(ownerId)} / basic identified as the active public example.`,
  showcaseTarget: { surface: 'component', id: ownerId, example: 'basic' },
  coverageClasses: coverageForComponent(ownerId),
  docsRoute: `/docs/components/reference/${ownerId}/`,
}));

const DOMAIN_SOURCE_PACK: Readonly<Record<string, string>> = {
  'auth-onboarding': 'auth',
  'dashboard-finance': 'dashboard-finance',
  'commerce-social': 'commerce-social',
  'account-settings': 'account-settings',
};

export const patternExamples: readonly ShowcaseExample[] = patternCatalog.flatMap((domain) =>
  domain.screens.map((screen) => {
    const states = screen.states?.map((state) => state.id) ?? [defaultPatternState(screen)];
    const state = defaultPatternState(screen);
    const pack = DOMAIN_SOURCE_PACK[domain.id] ?? domain.id;
    return {
      id: 'basic',
      ownerType: 'pattern' as const,
      ownerId: screen.id,
      title: `${screen.title} · ${state}`,
      intent: screen.description ?? `Inspect the ${screen.title} production pattern.`,
      sourcePath: `apps/showcase/patterns/${pack}/screens/${screen.id}-screen.tsx`,
      platform: ['web', 'ios', 'android'] as const,
      expectedResult: `Pattern Gallery opens ${domain.title} / ${screen.title} in state ${state}.`,
      showcaseTarget: { surface: 'pattern' as const, id: screen.id, state },
      coverageClasses: ['basic', 'states', 'production'] as const,
      stateIds: states,
      docsRoute: `/docs/patterns/reference/${screen.id}/`,
    };
  }),
);

export const fixtureExamples: readonly ShowcaseExample[] = [
  {
    id: 'default',
    ownerType: 'fixture',
    ownerId: 'dynamic-type',
    title: 'Dynamic Type acceptance',
    intent: 'Inspect the deterministic font-scale acceptance fixture.',
    sourcePath: 'apps/showcase/runtime-smoke/dynamic-type-acceptance.tsx',
    platform: ['ios', 'android'],
    expectedResult: 'Showcase opens the Dynamic Type acceptance surface.',
    showcaseTarget: { surface: 'fixture', id: 'dynamic-type' },
    coverageClasses: ['basic', 'accessibility', 'platform'],
  },
  {
    id: 'default',
    ownerType: 'fixture',
    ownerId: 'l10n-stress',
    title: 'Localization stress acceptance',
    intent: 'Inspect long-string, CJK, Arabic/RTL and pseudo-localized content.',
    sourcePath: 'apps/showcase/runtime-smoke/l10n-stress-acceptance.tsx',
    platform: ['web', 'ios', 'android'],
    expectedResult: 'Showcase opens the Localization stress acceptance surface.',
    showcaseTarget: { surface: 'fixture', id: 'l10n-stress' },
    coverageClasses: ['basic', 'accessibility', 'platform'],
  },
];

export const showcaseExampleRegistry: readonly ShowcaseExample[] = [
  ...componentExamples,
  ...patternExamples,
  ...fixtureExamples,
];

export type ResolvedShowcaseTarget =
  | { ok: true; target: ShowcaseTarget; example?: ShowcaseExample }
  | { ok: false; target: ShowcaseTarget; reason: string; recoveryTarget?: ShowcaseTarget };

export function findShowcaseExample(target: ShowcaseTarget) {
  if (target.surface === 'component') {
    return componentExamples.find((entry) => entry.ownerId === target.id && entry.id === (target.example ?? 'basic'));
  }
  if (target.surface === 'pattern') {
    return patternExamples.find((entry) => entry.ownerId === target.id);
  }
  if (target.surface === 'fixture') {
    return fixtureExamples.find((entry) => entry.ownerId === target.id);
  }
  return undefined;
}

export function resolveShowcaseTarget(target: ShowcaseTarget): ResolvedShowcaseTarget {
  if (target.surface === 'component') {
    const example = findShowcaseExample(target);
    if (!example) {
      const owner = componentExamples.find((entry) => entry.ownerId === target.id);
      return {
        ok: false,
        target,
        reason: owner ? `Example ${target.example ?? 'basic'} no longer exists for ${target.id}.` : `Component ${target.id} was not found.`,
        recoveryTarget: owner?.showcaseTarget,
      };
    }
    return { ok: true, target: example.showcaseTarget, example };
  }

  if (target.surface === 'pattern') {
    const domain = patternCatalog.find((candidate) => candidate.screens.some((screen) => screen.id === target.id));
    const screen = findPatternScreen(domain, target.id);
    if (!domain || !screen) return { ok: false, target, reason: `Pattern ${target.id} was not found.` };
    const state = target.state ?? defaultPatternState(screen);
    if (screen.states?.length && !screen.states.some((candidate) => candidate.id === state)) {
      return {
        ok: false,
        target,
        reason: `State ${state} no longer exists for pattern ${target.id}.`,
        recoveryTarget: { surface: 'pattern', id: target.id, state: defaultPatternState(screen) },
      };
    }
    return { ok: true, target: { ...target, state }, example: patternExamples.find((entry) => entry.ownerId === target.id) };
  }

  if (target.surface === 'fixture') {
    const example = findShowcaseExample(target);
    return example
      ? { ok: true, target: example.showcaseTarget, example }
      : { ok: false, target, reason: `Fixture ${target.id} was not found.` };
  }

  if (target.surface === 'tokens') return { ok: true, target };
  return { ok: false, target, reason: `Unsupported Showcase surface ${(target as ShowcaseTarget).surface}.` };
}

export function patternDomainForScreen(screenId: string) {
  return patternCatalog.find((domain) => domain.screens.some((screen) => screen.id === screenId));
}

export function canonicalPatternScreen(screenId: string) {
  const domain = patternDomainForScreen(screenId);
  return findPatternScreen(domain, screenId);
}
