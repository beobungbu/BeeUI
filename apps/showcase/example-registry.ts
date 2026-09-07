import {
  COMPONENT_COVERAGE,
  COVERAGE_RATIONALE,
  coverageForComponent,
  type ExampleCoverageClass,
} from './component-coverage';
import { defaultPatternState, findPatternScreen, patternCatalog } from './pattern-gallery/pattern-catalog';
import { PRODUCTION_PATTERN_USAGE } from './production-pattern-usage';
import type { ShowcaseTarget } from './showcase-target';

export type ShowcasePlatform = 'web' | 'ios' | 'android';
export { COVERAGE_RATIONALE, coverageForComponent };
export type { ExampleCoverageClass };

export type ShowcaseScreenshotTarget = {
  /** Canonical target the screenshot must open. */
  target: ShowcaseTarget;
  /** Stable evidence name; screenshots that drift to another target change this name. */
  name: string;
};

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
  applicableCoverageClasses?: readonly ExampleCoverageClass[];
  focusTestId?: string;
  focusText?: string;
  stateIds?: readonly string[];
  docsRoute?: string;
  /**
   * #472 section 2's `production` class: the real pattern targets that compose this component.
   * It is a mapping rather than an example row because the pattern lives on another surface.
   */
  productionTargets?: readonly ShowcaseTarget[];
  /** #472 section 11: stable identity for generated screenshot/visual evidence. */
  screenshotTarget?: ShowcaseScreenshotTarget;
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
  ['keyboard-aware-screen', 'apps/showcase/patterns/account-settings/components/settings-screen-shell.tsx'],
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

const PLATFORM_SPLIT_COMPONENTS = new Set(['date-picker', 'date-time-picker', 'sheet', 'table', 'tooltip']);

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .map((part) => part === 'otp' ? 'OTP' : part === 'bee' ? 'Bee' : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function componentExample(
  ownerId: string,
  sourcePath: string,
  exampleId: ExampleCoverageClass,
  applicableCoverageClasses: readonly ExampleCoverageClass[],
): ShowcaseExample {
  const title = titleFromSlug(ownerId);
  const focus = COMPONENT_COVERAGE[ownerId]?.[exampleId] ?? {};
  return {
    id: exampleId,
    ownerType: 'component',
    ownerId,
    title: `${title} · ${exampleId}`,
    intent: exampleId === 'basic'
      ? `Inspect the canonical executable ${title} usage selected by BeeUI's public component preview contract.`
      : `Inspect the ${exampleId} behavior exercised by a distinct ${title} example in the canonical executable fixture.`,
    sourcePath,
    platform: PLATFORM_SPLIT_COMPONENTS.has(ownerId)
      ? (['web', 'ios', 'android'] as const)
      : (['web', 'ios', 'android'] as const),
    expectedResult: `Showcase opens ${title} / ${exampleId} and positions the canonical executable fixture at that example.`,
    showcaseTarget: { surface: 'component', id: ownerId, example: exampleId },
    coverageClasses: [exampleId],
    applicableCoverageClasses,
    ...focus,
    docsRoute: `/docs/components/${ownerId}/`,
    ...(exampleId === 'basic' && PRODUCTION_PATTERN_USAGE[ownerId]?.length
      ? {
        productionTargets: PRODUCTION_PATTERN_USAGE[ownerId].map((patternId) => ({
          surface: 'pattern' as const,
          id: patternId,
        })),
      }
      : {}),
    screenshotTarget: {
      target: { surface: 'component', id: ownerId, example: exampleId },
      name: `component-${ownerId}-${exampleId}`,
    },
  };
}

export const componentExamples: readonly ShowcaseExample[] = COMPONENT_FIXTURES.flatMap(([ownerId, sourcePath]) => {
  const applicable = coverageForComponent(ownerId);
  return applicable.map((exampleId) => componentExample(ownerId, sourcePath, exampleId, applicable));
});

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
      applicableCoverageClasses: ['basic', 'states', 'production'] as const,
      stateIds: states,
      docsRoute: `/docs/patterns/${screen.id}/`,
      screenshotTarget: {
        target: { surface: 'pattern' as const, id: screen.id, state },
        name: `pattern-${screen.id}-${state}`,
      },
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
    applicableCoverageClasses: ['basic', 'accessibility', 'platform'],
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
    applicableCoverageClasses: ['basic', 'accessibility', 'platform'],
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
      const owner = componentExamples.find((entry) => entry.ownerId === target.id && entry.id === 'basic');
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
