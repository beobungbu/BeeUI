import { expect, test } from '@playwright/test';
import { awaitSettledModalOwners } from '../src/a11y-scenarios';

// #145/#280 — load-bearing regression for the overlay scenario's readiness
// contract.
//
// react-native-web's Modal mounts its owner node with `aria-modal="true"`
// before the allowed dialog role lands (role is applied when the entrance
// completes). An axe scan inside that window reports a transient critical
// `aria-allowed-attr` violation that no settled DOM exhibits — the #280
// readiness race. Coverage is deliberately split in two:
//
//   1. the real Showcase/RNW integration test installs a MutationObserver
//      before opening the dialog, verifies the settled state unconditionally,
//      and records whether the timing-dependent transient was observed;
//   2. a deterministic synthetic lifecycle test starts from the exact invalid
//      intermediate DOM shape and proves awaitSettledModalOwners() does not
//      consider the overlay ready until the dialog role lands.
//
// This keeps the production synchronization state-based (no sleeps and no
// allowlist) while making the regression proof deterministic even on browsers
// where RNW's transient window closes before MutationObserver delivery.

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

  const settled = await page.evaluate(() => ({
    owners: document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]').length,
    unsettled: Array.from(document.querySelectorAll('[aria-modal="true"]')).filter((node) => {
      const role = node.getAttribute('role');
      return role !== 'dialog' && role !== 'alertdialog';
    }).length,
  }));
  expect(settled.owners).toBeGreaterThanOrEqual(1);
  expect(settled.unsettled).toBe(0);

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

test('awaitSettledModalOwners deterministically waits through roleless aria-modal intermediate state', async ({ page }) => {
  await page.setContent('<div id="modal-owner" aria-modal="true">Dialog content</div>');

  // Pin the exact #280 intermediate DOM shape before starting the waiter.
  const transient = await page.evaluate(() => {
    const owner = document.getElementById('modal-owner');
    return {
      ariaModal: owner?.getAttribute('aria-modal'),
      role: owner?.getAttribute('role'),
    };
  });
  expect(transient).toEqual({ ariaModal: 'true', role: null });

  // Mutate on the next animation frame, mirroring RNW's entrance lifecycle.
  // Promise.all ensures the readiness waiter is already active while the DOM
  // is still transient; it can only resolve after the role mutation satisfies
  // its state predicate.
  const roleLands = page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          document.getElementById('modal-owner')?.setAttribute('role', 'dialog');
          resolve();
        });
      }),
  );

  await Promise.all([awaitSettledModalOwners(page), roleLands]);

  const finalState = await page.evaluate(() => {
    const owner = document.getElementById('modal-owner');
    return {
      ariaModal: owner?.getAttribute('aria-modal'),
      role: owner?.getAttribute('role'),
    };
  });
  expect(finalState).toEqual({ ariaModal: 'true', role: 'dialog' });
});
