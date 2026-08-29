import { expect, test } from '@playwright/test';
import { awaitSettledModalOwners } from '../src/a11y-scenarios';

// #145/#280 — load-bearing regression for the overlay scenario's readiness
// contract.
//
// react-native-web's Modal mounts its owner node with `aria-modal="true"`
// before the allowed dialog role lands (role is applied when the entrance
// completes). An axe scan inside that window reports a transient critical
// `aria-allowed-attr` violation that no settled DOM exhibits — the #280
// misdiagnosis. This spec pins both halves of the corrected understanding:
//
//   1. (unconditional) after `awaitSettledModalOwners`, the DOM holds a
//      settled `[role="dialog"][aria-modal="true"]` owner and zero
//      `aria-modal` nodes without an allowed dialog role — the exact state
//      the dialog-overlay a11y scenario now requires before invoking axe;
//   2. (lifecycle, when observable) any roleless `aria-modal` node captured
//      by a MutationObserver installed *before* the dialog opens either
//      gains an allowed role or disconnects — i.e. the transient state is
//      entrance-lifecycle, not a persistent product defect.
//
// The transient window is timing-dependent (a fast render can close it
// before the observer's microtask sees it), so assertion 2 only runs when a
// transient node was actually captured; assertion 1 is the contract that
// must always hold and is what the a11y scenario synchronizes on.

const showcaseBaseUrl = 'http://127.0.0.1:4174';

test('dialog-overlay a11y scenario readiness: modal owner settles into role="dialog" + aria-modal before axe may run', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(showcaseBaseUrl, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Open Components' }).click();
  await page.getByTestId('component-gallery').waitFor({ state: 'visible' });

  // Install the observer before opening the dialog so any transient
  // roleless aria-modal owner is captured the moment it connects.
  await page.evaluate(() => {
    const captured: { sawTransient: boolean; nodes: Element[] } = { sawTransient: false, nodes: [] };
    const isUnsettled = (node: Element) => {
      if (node.getAttribute('aria-modal') !== 'true') return false;
      const role = node.getAttribute('role');
      return role !== 'dialog' && role !== 'alertdialog';
    };
    const scan = (root: Element) => {
      const candidates = [root, ...Array.from(root.querySelectorAll('[aria-modal="true"]'))];
      for (const candidate of candidates) {
        if (isUnsettled(candidate) && !captured.nodes.includes(candidate)) {
          captured.sawTransient = true;
          captured.nodes.push(candidate);
        }
      }
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          scan(mutation.target);
        }
        for (const added of Array.from(mutation.addedNodes)) {
          if (added instanceof Element) scan(added);
        }
      }
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-modal', 'role'],
      childList: true,
      subtree: true,
    });
    (window as unknown as { __beeuiModalProbe: typeof captured }).__beeuiModalProbe = captured;
  });

  await page.getByRole('button', { name: 'Open Dialog' }).click();
  await awaitSettledModalOwners(page);

  // 1. Unconditional settled-state contract (what the a11y scenario scans).
  const settled = await page.evaluate(() => ({
    owners: document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]').length,
    unsettled: Array.from(document.querySelectorAll('[aria-modal="true"]')).filter((node) => {
      const role = node.getAttribute('role');
      return role !== 'dialog' && role !== 'alertdialog';
    }).length,
  }));
  expect(settled.owners).toBeGreaterThanOrEqual(1);
  expect(settled.unsettled).toBe(0);

  // 2. Lifecycle disposition of any captured transient owner: it must have
  // settled into an allowed role or left the DOM — never persisted invalid.
  const probe = await page.evaluate(() => {
    const captured = (window as unknown as {
      __beeuiModalProbe: { sawTransient: boolean; nodes: Element[] };
    }).__beeuiModalProbe;
    return {
      sawTransient: captured.sawTransient,
      unresolved: captured.nodes.filter((node) => {
        if (!node.isConnected) return false;
        if (node.getAttribute('aria-modal') !== 'true') return false;
        const role = node.getAttribute('role');
        return role !== 'dialog' && role !== 'alertdialog';
      }).length,
    };
  });
  expect(probe.unresolved).toBe(0);
  test.info().annotations.push({
    type: 'rnw-modal-transient-observed',
    description: String(probe.sawTransient),
  });
});
