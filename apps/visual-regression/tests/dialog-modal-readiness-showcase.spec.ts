import { expect, test } from '@playwright/test';

const showcaseBaseUrl = 'http://127.0.0.1:4174';

test('proves the transient roleless aria-modal belongs to RNW Modal entrance readiness', async ({ page }) => {
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await expect(page.getByTestId('component-gallery')).toBeVisible();

  await page.evaluate(() => {
    type Probe = {
      invalidSamples: string[];
      trackedInvalidNodes: Element[];
      observer: MutationObserver;
    };
    const probeWindow = window as typeof window & { __beeuiModalProbe?: Probe };
    const invalidSamples: string[] = [];
    const trackedInvalidNodes: Element[] = [];

    const record = () => {
      for (const element of Array.from(document.querySelectorAll('[aria-modal="true"]'))) {
        const role = element.getAttribute('role');
        if (role !== 'dialog' && role !== 'alertdialog') {
          if (!trackedInvalidNodes.includes(element)) trackedInvalidNodes.push(element);
          invalidSamples.push(element.outerHTML);
        }
      }
    };

    const observer = new MutationObserver(record);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-modal', 'role'],
      childList: true,
      subtree: true,
    });
    record();
    probeWindow.__beeuiModalProbe = { invalidSamples, trackedInvalidNodes, observer };
  });

  await page.getByRole('button', { name: 'Open Dialog' }).click();
  await expect(page.getByText('Project settings', { exact: true })).toBeVisible();

  await page.waitForFunction(() => {
    type Probe = { trackedInvalidNodes: Element[] };
    const probeWindow = window as typeof window & { __beeuiModalProbe?: Probe };
    const nodes = probeWindow.__beeuiModalProbe?.trackedInvalidNodes ?? [];
    return (
      nodes.length > 0 &&
      nodes.every((element) => {
        const role = element.getAttribute('role');
        return !element.isConnected || role === 'dialog' || role === 'alertdialog';
      })
    );
  });

  const result = await page.evaluate(() => {
    type Probe = {
      invalidSamples: string[];
      trackedInvalidNodes: Element[];
      observer: MutationObserver;
    };
    const probeWindow = window as typeof window & { __beeuiModalProbe?: Probe };
    const probe = probeWindow.__beeuiModalProbe;
    if (!probe) throw new Error('Modal readiness probe was not installed.');
    probe.observer.disconnect();

    const settledInvalid = Array.from(document.querySelectorAll('[aria-modal="true"]'))
      .filter((element) => {
        const role = element.getAttribute('role');
        return role !== 'dialog' && role !== 'alertdialog';
      })
      .map((element) => element.outerHTML);

    return {
      invalidSamples: probe.invalidSamples,
      settledInvalid,
      trackedRoles: probe.trackedInvalidNodes.map((element) => element.getAttribute('role')),
    };
  });

  expect(result.invalidSamples.length).toBeGreaterThan(0);
  expect(result.invalidSamples.some((html) => html.includes('aria-modal="true"'))).toBe(true);
  expect(result.trackedRoles.every((role) => role === 'dialog' || role === 'alertdialog')).toBe(true);
  expect(result.settledInvalid).toEqual([]);
});
