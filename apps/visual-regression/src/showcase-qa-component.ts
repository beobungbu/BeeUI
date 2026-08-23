import type { Browser } from '@playwright/test';
import {
  attachRuntimeErrors,
  componentPageOverflow,
  scrollScrollableWithin,
  verifyTheme,
} from './showcase-qa-browser';

const contexts = [
  { name: '390x844', width: 390, height: 844, theme: 'light' as const },
  { name: '390x844', width: 390, height: 844, theme: 'dark' as const },
  { name: '1280x800', width: 1280, height: 800, theme: 'light' as const },
  { name: '1280x800', width: 1280, height: 800, theme: 'dark' as const },
];

const expectedExamples = [
  'Hands-on playground',
  'Foundation',
  'Status and feedback',
  'Toast notifications',
  'Loading and state surfaces',
  'Forms',
  'Overlay playground',
  'Dialog and AlertDialog',
  'Popover placements',
  'DropdownMenu',
  'Nested Popover',
  'Collision edge case',
  'Navigation and composition',
  'Selection and navigation',
  'Tabs and disclosure',
  'Application composition',
  'Metadata and rows',
];

export async function runComponentGalleryMatrix(browser: Browser, baseUrl: string) {
  const groups: Array<{ key: string; problems: string[]; runtimeErrors: string[] }> = [];

  for (const group of contexts) {
    const context = await browser.newContext({
      viewport: { width: group.width, height: group.height },
      colorScheme: group.theme,
      deviceScaleFactor: 1,
      locale: 'en-US',
      timezoneId: 'UTC',
    });
    const page = await context.newPage();
    const runtimeErrors = attachRuntimeErrors(page);
    const problems: string[] = [];

    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Open Components' }).click();
    await page.getByTestId('component-gallery').waitFor({ state: 'visible' });
    await verifyTheme(page, group.theme);

    for (const text of expectedExamples) {
      if (await page.getByText(text, { exact: true }).count() === 0) {
        problems.push(`missing component example: ${text}`);
      }
    }

    const email = page.getByPlaceholder('you@example.com');
    await email.fill('qa@example.com');
    if ((await email.inputValue()) !== 'qa@example.com') problems.push('form input did not update');

    await page.getByRole('button', { name: 'Success', exact: true }).click();
    await page.getByText('Published', { exact: true }).waitFor({ state: 'visible' });

    if ((await componentPageOverflow(page, group.width)) > 1) problems.push('page horizontal overflow at top');
    await scrollScrollableWithin(page, '[data-testid="component-gallery"]', true);
    if ((await componentPageOverflow(page, group.width)) > 1) problems.push('page horizontal overflow at bottom');

    await page.reload({ waitUntil: 'load' });
    await page.getByRole('button', { name: 'Open Components' }).click();
    await page.getByRole('button', { name: 'Open Dialog' }).click();
    await page.getByText('Project settings', { exact: true }).waitFor({ state: 'visible' });

    await page.reload({ waitUntil: 'load' });
    await page.getByRole('button', { name: 'Open Components' }).click();
    await page.getByRole('button', { name: 'bottom', exact: true }).click();
    await page.getByText('Bottom placement', { exact: true }).waitFor({ state: 'visible' });

    await page.reload({ waitUntil: 'load' });
    await page.getByRole('button', { name: 'Open Components' }).click();
    await page.getByRole('button', { name: 'Workspace menu' }).click();
    await page.getByText('Edit project', { exact: true }).waitFor({ state: 'visible' });

    await page.reload({ waitUntil: 'load' });
    await page.getByRole('button', { name: 'Open Components' }).click();
    await page.getByRole('button', { name: 'Back to Showcase home' }).click();
    await page.getByTestId('showcase-home').waitFor({ state: 'visible' });
    if (await page.getByTestId('component-gallery').count()) problems.push('component gallery remained mounted after Back');

    groups.push({
      key: `${group.name}-${group.theme}`,
      problems,
      runtimeErrors: Array.from(new Set(runtimeErrors)),
    });
    await context.close();
  }

  return groups;
}
