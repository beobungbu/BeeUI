import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// Application-level keyboard shortcuts (F-keys, Alt/Ctrl/Cmd chords, Escape)
// are bound on `window` or `document` in the bubble phase. While a BeeUI
// `Input`/`SearchInput` holds focus, those listeners must still receive the
// keydown exactly once — the same as for a plain `<input>` — without a
// capture-phase listener seeing it twice, and without overriding a field
// whose own `onKeyPress` deliberately stops propagation.
//
// Why a regression here is easy to miss: react-native-web's TextInput calls
// `stopPropagation()` on every keydown before any caller handler runs
// (`react-native-web/dist/exports/TextInput/index.js`, `handleKeyDown`). That
// call happens at React's root container, i.e. after every capture listener
// and every native listener between the field and the root have already run,
// so a spec that only listens in the capture phase, or only on an element
// inside the React root, stays green while every window/document shortcut is
// dead.

type Phase = 'window-capture' | 'document-capture' | 'document-bubble' | 'window-bubble';

type KeydownRecord = { code: string; defaultPrevented: boolean; phase: Phase };

type KeydownWindow = Window & { __keydownRecords: KeydownRecord[] };

const PHASES: readonly Phase[] = ['window-capture', 'document-capture', 'document-bubble', 'window-bubble'];

const FIELDS = [
  { name: 'Input', testId: 'keydown-bubble-input' },
  { name: 'SearchInput', testId: 'keydown-bubble-search-input' },
] as const;

// `code` identifies the physical key regardless of the character a modifier
// chord produces, so the modifier's own keydown (Alt, Control) is not counted.
const KEYS = [
  { press: 'a', code: 'KeyA' },
  { press: 'Escape', code: 'Escape' },
  { press: 'Enter', code: 'Enter' },
  { press: 'F3', code: 'F3' },
  { press: 'Alt+1', code: 'Digit1' },
  { press: 'Control+k', code: 'KeyK' },
] as const;

function restrictToOneProject(testInfo: TestInfo) {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  // Event propagation is orthogonal to the theme and viewport axes.
  test.skip(
    metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
    'keydown propagation is theme- and viewport-independent',
  );
}

async function openFixture(page: Page) {
  await page.addInitScript(() => {
    const target = window as unknown as KeydownWindow;
    target.__keydownRecords = [];
    const record = (phase: Phase) => (event: KeyboardEvent) => {
      target.__keydownRecords.push({ code: event.code, defaultPrevented: event.defaultPrevented, phase });
    };
    window.addEventListener('keydown', record('window-capture'), true);
    document.addEventListener('keydown', record('document-capture'), true);
    document.addEventListener('keydown', record('document-bubble'));
    window.addEventListener('keydown', record('window-bubble'));
  });
  await page.goto('/?fixture=keydown-bubble', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('keydown-bubble-fixture')).toBeVisible();
}

async function pressAndCollect(page: Page, testId: string, press: string, code: string) {
  const field = page.getByTestId(testId);
  // Enter submits and blurs a single-line field; refocus before every key.
  await field.focus();
  await expect(field).toBeFocused();
  await page.evaluate(() => {
    (window as unknown as KeydownWindow).__keydownRecords = [];
  });
  await page.keyboard.press(press);
  const records = await page.evaluate(() => (window as unknown as KeydownWindow).__keydownRecords);
  return records.filter((entry) => entry.code === code);
}

function countByPhase(records: KeydownRecord[]) {
  return Object.fromEntries(
    PHASES.map((phase) => [phase, records.filter((entry) => entry.phase === phase).length]),
  ) as Record<Phase, number>;
}

const EXACTLY_ONCE_EVERYWHERE: Record<Phase, number> = {
  'window-capture': 1,
  'document-capture': 1,
  'document-bubble': 1,
  'window-bubble': 1,
};

test('a plain <input> delivers keydown once to window and document in both phases (harness control)', async ({
  page,
}, testInfo) => {
  restrictToOneProject(testInfo);
  await openFixture(page);
  await page.evaluate(() => {
    const plain = document.createElement('input');
    plain.setAttribute('data-testid', 'keydown-bubble-plain-input');
    document.body.appendChild(plain);
  });

  for (const key of KEYS) {
    const records = await pressAndCollect(page, 'keydown-bubble-plain-input', key.press, key.code);
    expect(countByPhase(records), `plain <input>, ${key.press}`).toEqual(EXACTLY_ONCE_EVERYWHERE);
  }
});

for (const field of FIELDS) {
  test(`a focused ${field.name} lets keydown bubble to window and document exactly once`, async ({
    page,
  }, testInfo) => {
    restrictToOneProject(testInfo);
    await openFixture(page);

    for (const key of KEYS) {
      const records = await pressAndCollect(page, field.testId, key.press, key.code);
      expect(countByPhase(records), `${field.name}, ${key.press}`).toEqual(EXACTLY_ONCE_EVERYWHERE);
    }
  });

  test(`a focused ${field.name} still handles its own keys while they bubble`, async ({ page }, testInfo) => {
    restrictToOneProject(testInfo);
    await openFixture(page);

    const input = page.getByTestId(field.testId);
    await pressAndCollect(page, field.testId, 'a', 'KeyA');
    await expect(input).toHaveValue('a');
  });
}

test('SearchInput marks the Enter it consumes as submit with defaultPrevented for window/document listeners', async ({
  page,
}, testInfo) => {
  restrictToOneProject(testInfo);
  await openFixture(page);

  const records = await pressAndCollect(page, 'keydown-bubble-search-input', 'Enter', 'Enter');
  const bubbled = records.filter((entry) => entry.phase === 'document-bubble' || entry.phase === 'window-bubble');
  expect(bubbled).toHaveLength(2);
  for (const entry of bubbled) expect(entry.defaultPrevented, entry.phase).toBe(true);
});

test('an Input whose onKeyPress stops propagation still keeps keydown from window and document', async ({
  page,
}, testInfo) => {
  restrictToOneProject(testInfo);
  await openFixture(page);

  for (const key of KEYS) {
    const records = await pressAndCollect(page, 'keydown-bubble-stopping-input', key.press, key.code);
    expect(countByPhase(records), `stopping Input, ${key.press}`).toEqual({
      'window-capture': 1,
      'document-capture': 1,
      'document-bubble': 0,
      'window-bubble': 0,
    });
  }
});
