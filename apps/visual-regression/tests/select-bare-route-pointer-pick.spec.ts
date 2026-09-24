import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import type { VisualProjectMetadata } from '../src/visual-contract';

// A consumer's minimal probe route: a 20-option Select sitting directly in the document (no app
// shell, no showcase ScrollView), opened at 1280x800 and picked with a real mouse. The list is
// 20 x 40 pt under the default 320 pt cap, so it overflows by 480 pt.
//
// `select-overflowing-list-mouse-pick.spec.ts` stays green while this condition fails because
// it only ever picks the LAST option of its list after `scrollIntoViewIfNeeded()`: once a list
// is scrolled to its end, any further scroll clamps and the last row stays under the pointer.
// Every other row is where the defect lives: hovering an option made it current, and making an
// option current scrolled it to the top of the list, which slid another option under the
// pointer, which hovered next — a cascade that only stopped at the end of the list. A press on
// visible option 5 then landed on option 17.

function skipOutsideLightDesktop(testInfo: TestInfo) {
  const metadata = testInfo.project.metadata as VisualProjectMetadata;
  test.skip(
    metadata.visualTheme !== 'light' || metadata.visualViewport !== 'desktop',
    'Pointer picking is orthogonal to theme; the reported condition is the 1280x800 viewport.',
  );
}

async function gotoFixture(page: Page) {
  await page.goto('/?fixture=select-minimal-route', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-visual-ready', 'true');
}

function listScroller(content: Locator) {
  return content.locator('> div').first();
}

async function scrollTopOf(content: Locator) {
  return listScroller(content).evaluate((element) => (element as HTMLElement).scrollTop);
}

async function openList(page: Page, id: string) {
  await page.getByTestId(`${id}-trigger`).click();
  const content = page.getByTestId(`${id}-content`);
  // The list first renders off-screen to be measured (still "visible" to Playwright), then
  // moves under the trigger and drops `aria-hidden`; aim the mouse only after that.
  await expect(content).toBeInViewport();
  await expect(content).not.toHaveAttribute('aria-hidden', 'true');
  return content;
}

// Moves the mouse onto the option in small steps, as a hand does, then presses it — the
// press lands wherever the option is at that moment, never re-aimed after the move.
async function pointerPick(page: Page, option: Locator) {
  const box = await option.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y, { steps: 8 });
  // Give any hover-driven re-render a chance to move the list before the press.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  await page.mouse.down();
  await page.mouse.up();
}

test('hovering a visible option of an overflowing Select on a bare route leaves the list where it is', async ({
  page,
}, testInfo) => {
  skipOutsideLightDesktop(testInfo);
  await gotoFixture(page);
  const content = await openList(page, 'select-long');
  expect(await scrollTopOf(content)).toBe(0);

  for (const index of [5, 8, 3, 6]) {
    const option = page.getByTestId(`select-long-option-${index}`);
    const box = await option.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 8 });
    await expect(option).toBeFocused();
    expect(await scrollTopOf(content)).toBe(0);
  }
});

for (const index of [1, 5, 6, 8]) {
  test(`a mouse press on visible option ${index} of a 20-option Select on a bare route commits exactly that option`, async ({
    page,
  }, testInfo) => {
    skipOutsideLightDesktop(testInfo);
    await gotoFixture(page);
    const content = await openList(page, 'select-long');

    await pointerPick(page, page.getByTestId(`select-long-option-${index}`));

    await expect(content).toBeHidden();
    await expect(page.getByTestId('select-long-value')).toHaveText(`Option ${index}`);
  });
}

test('a mouse press on a middle option after wheel-scrolling the list commits that option', async ({
  page,
}, testInfo) => {
  skipOutsideLightDesktop(testInfo);
  await gotoFixture(page);
  const content = await openList(page, 'select-long');

  const scroller = listScroller(content);
  const scrollerBox = await scroller.boundingBox();
  await page.mouse.move(scrollerBox!.x + scrollerBox!.width / 2, scrollerBox!.y + 20);
  await page.mouse.wheel(0, 200);
  await expect.poll(() => scrollTopOf(content)).toBe(200);

  await pointerPick(page, page.getByTestId('select-long-option-10'));

  await expect(content).toBeHidden();
  await expect(page.getByTestId('select-long-value')).toHaveText('Option 10');
});

test('reopening a Select after a pick shows the picked option and a second press commits the one under the pointer', async ({
  page,
}, testInfo) => {
  skipOutsideLightDesktop(testInfo);
  await gotoFixture(page);
  let content = await openList(page, 'select-long');
  await pointerPick(page, page.getByTestId('select-long-option-6'));
  await expect(page.getByTestId('select-long-value')).toHaveText('Option 6');

  content = await openList(page, 'select-long');
  await expect(page.getByTestId('select-long-option-6')).toBeInViewport();
  await pointerPick(page, page.getByTestId('select-long-option-7'));
  await expect(content).toBeHidden();
  await expect(page.getByTestId('select-long-value')).toHaveText('Option 7');
});

test('ArrowDown through an overflowing Select keeps the focused option inside the list', async ({
  page,
}, testInfo) => {
  skipOutsideLightDesktop(testInfo);
  await gotoFixture(page);
  const content = await openList(page, 'select-long');
  const scroller = listScroller(content);
  await expect(page.getByTestId('select-long-option-1')).toBeFocused();

  for (let index = 2; index <= 14; index += 1) {
    await page.keyboard.press('ArrowDown');
    const option = page.getByTestId(`select-long-option-${index}`);
    await expect(option).toBeFocused();
    const scrollerBox = await scroller.boundingBox();
    const optionBox = await option.boundingBox();
    expect(optionBox!.y).toBeGreaterThanOrEqual(scrollerBox!.y - 1);
    expect(optionBox!.y + optionBox!.height).toBeLessThanOrEqual(scrollerBox!.y + scrollerBox!.height + 1);
  }

  await page.keyboard.press('Enter');
  await expect(content).toBeHidden();
  await expect(page.getByTestId('select-long-value')).toHaveText('Option 14');
});

test('a list that opens under a resting pointer keeps the keyboard current option', async ({
  page,
}, testInfo) => {
  skipOutsideLightDesktop(testInfo);
  await gotoFixture(page);

  // Learn where option 3 appears, close the list, and leave the mouse resting there.
  let content = await openList(page, 'select-long');
  const optionBox = await page.getByTestId('select-long-option-3').boundingBox();
  await page.keyboard.press('Escape');
  await expect(content).toBeHidden();
  await page.mouse.move(optionBox!.x + optionBox!.width / 2, optionBox!.y + optionBox!.height / 2);

  const trigger = page.getByTestId('select-long-trigger');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  content = page.getByTestId('select-long-content');
  await expect(content).toBeInViewport();
  await expect(page.getByTestId('select-long-option-1')).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('select-long-option-2')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(content).toBeHidden();
  await expect(page.getByTestId('select-long-value')).toHaveText('Option 2');
});

test('a mouse press on an option of a 5-option Select on a bare route commits it', async ({
  page,
}, testInfo) => {
  skipOutsideLightDesktop(testInfo);
  await gotoFixture(page);
  const content = await openList(page, 'select-short');
  await pointerPick(page, page.getByTestId('select-short-option-4'));
  await expect(content).toBeHidden();
  await expect(page.getByTestId('select-short-value')).toHaveText('Option 4');
});
