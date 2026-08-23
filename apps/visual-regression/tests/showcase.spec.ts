import { expect, test } from '@playwright/test';
import { runComponentGalleryMatrix } from '../src/showcase-qa-component';
import { runPatternFullMatrix } from '../src/showcase-qa-pattern-full';
import {
  representativeScenarios,
  runPatternSmokeMatrix,
} from '../src/showcase-qa-pattern-smoke';
import { buildAndServeShowcase, stopShowcaseServer } from '../src/showcase-qa-server';

const runFullMatrix = process.env.CI === 'true' || process.env.BEEUI_FULL_PATTERN_GALLERY_QA === '1';
let showcaseBaseUrl = '';
let showcaseServer: Awaited<ReturnType<typeof buildAndServeShowcase>>['server'] | undefined;

test.beforeAll(async () => {
  test.setTimeout(4 * 60 * 1000);
  const started = await buildAndServeShowcase();
  showcaseBaseUrl = started.baseUrl;
  showcaseServer = started.server;
});

test.afterAll(async () => {
  await stopShowcaseServer(showcaseServer);
});

test('preserves the Component Gallery across mobile/desktop and light/dark', async ({ browser }) => {
  test.setTimeout(3 * 60 * 1000);
  const groups = await runComponentGalleryMatrix(browser, showcaseBaseUrl);
  console.log(`BEEUI_COMPONENT_GALLERY_MATRIX ${JSON.stringify(groups)}`);
  expect(groups).toHaveLength(4);
  expect(groups.filter((group) => group.problems.length || group.runtimeErrors.length)).toEqual([]);
});

test('runs the durable representative Pattern Gallery integration matrix', async ({ browser }) => {
  test.setTimeout(4 * 60 * 1000);
  const groups = await runPatternSmokeMatrix(browser, showcaseBaseUrl);
  const totalRenders = groups.reduce((sum, group) => sum + group.rendered, 0);
  console.log(`BEEUI_GALLERY_SMOKE_MATRIX ${JSON.stringify({
    groups: groups.length,
    screensPerGroup: representativeScenarios.length,
    totalRenders,
    groupsDetail: groups,
  })}`);
  expect(groups).toHaveLength(5);
  expect(totalRenders).toBe(45);
  expect(groups.filter((group) => group.problems.length || group.runtimeErrors.length)).toEqual([]);
});

(runFullMatrix ? test : test.skip)('runs the full 37-screen acceptance matrix without PNG baselines', async ({ browser }) => {
  test.setTimeout(12 * 60 * 1000);
  const result = await runPatternFullMatrix(browser, showcaseBaseUrl);
  console.log(`BEEUI_GALLERY_FULL_MATRIX ${JSON.stringify({
    browser: result.browser,
    viewportGroups: result.viewportGroups,
    themes: result.themes,
    groups: result.groups.length,
    screensPerGroup: 37,
    totalRenders: result.totalRenders,
    failedGroups: result.failedGroups,
  })}`);
  expect(result.groups).toHaveLength(10);
  expect(result.totalRenders).toBe(370);
  expect(result.failedGroups).toEqual([]);
});
