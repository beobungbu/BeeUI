import { expect, test } from '@playwright/test';

// Root cause (verified against the installed react-native-web@0.21.0 package,
// `dist/exports/TextInput/index.js`'s `handleKeyDown`): react-native-web's
// own TextInput calls `e.stopPropagation()` on every keydown unconditionally
// — the exact line comments it as "Prevent key events bubbling (see #612)" —
// regardless of whether the key was consumed by the field. This stops the
// underlying native event from ever reaching a bubble-phase `document`
// listener. BeeUI's own `Input`/`SearchInput`/`Textarea` source never calls
// `stopPropagation` anywhere (confirmed by inspection) — the swallow
// originates entirely inside the react-native-web dependency, outside
// BeeUI's owned component surface.
//
// A capture-phase listener (`addEventListener('keydown', handler, true)`)
// still sees the event: capture happens before react-native-web's bubble-phase
// handler runs `stopPropagation`. That is the documented workaround for
// consumers who need application-level keyboard shortcuts (Alt/Cmd chords,
// F-keys) while a BeeUI Input holds focus.
//
// `test.fixme` because the fix is not reachable from any file BeeUI owns
// (packages/ui / packages/core): removing or gating react-native-web's own
// `stopPropagation` call would require an upstream react-native-web patch, and
// a BeeUI-side workaround that re-dispatches a synthetic bubble event would
// make a capture-phase listener (the workaround above) see the same logical
// keydown twice — an unacceptable regression for exactly the consumers this
// fix would be for.
test.fixme(
  'root cause: react-native-web TextInput calls stopPropagation() on every keydown, so a focused Input never reaches a bubble-phase document listener (upstream react-native-web behavior, not fixable from BeeUI-owned files)',
  async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __bubbleKeydownCount: number }).__bubbleKeydownCount = 0;
      document.addEventListener('keydown', () => {
        (window as unknown as { __bubbleKeydownCount: number }).__bubbleKeydownCount += 1;
      });
    });

    await page.goto('/?fixture=keydown-bubble', { waitUntil: 'domcontentloaded' });

    const input = page.getByTestId('keydown-bubble-input');
    await input.click();
    await page.keyboard.press('a');

    const bubbleCount = await page.evaluate(
      () => (window as unknown as { __bubbleKeydownCount: number }).__bubbleKeydownCount,
    );
    expect(bubbleCount).toBe(1);
  },
);
