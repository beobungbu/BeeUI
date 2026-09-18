import { AlertDialog, AlertDialogContent, AlertDialogTitle, Dialog, DialogContent, DialogTitle } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';
import { AccessibilityInfo, Modal, Platform, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

// Silences DialogContent's own ambient reduced-motion signal read (unrelated
// to this file's assertions) so it settles synchronously instead of an
// unresolved microtask racing past `render`.
jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({
  remove: () => undefined,
} as ReturnType<typeof AccessibilityInfo.addEventListener>);

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View: MockView } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <MockView ref={ref} {...props}>
          {children}
        </MockView>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

// react-native-web's own `Modal` (`ModalContent`, verified against the
// installed 0.21 package) unconditionally renders `role="dialog"` +
// `aria-modal="true"` on its own owner node once open, regardless of any prop
// passed to `<Modal>` — there is no supported way to opt that wrapper out.
// `DialogContent`/`AlertDialogContent` previously ALSO stamped `role="dialog"`
// + `aria-modal` on their own panel `View` underneath, unconditionally on
// every platform, producing two nested `role="dialog"` nodes on Web: a
// Playwright `getByRole('dialog')` strict-mode violation without a name
// filter, and two "entered a dialog" screen-reader announcements for one
// open dialog. On Web the panel now leaves `role`/`aria-modal`/the
// label to the `<Modal>` owner instead of duplicating them; native (which has
// no such forced wrapper) is unaffected.

const originalPlatformOS = Platform.OS;

function setPlatform(os: 'ios' | 'web') {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
});

describe('Dialog Web modal owner (single role="dialog" node)', () => {
  it('moves role/aria-modal/label to the Modal owner on Web, leaving the panel plain', () => {
    setPlatform('web');
    const screen = render(
      <OverlayRuntimeProvider>
        <Dialog defaultOpen>
          <DialogContent testID="dialog-content">
            <DialogTitle>Project settings</DialogTitle>
          </DialogContent>
        </Dialog>
      </OverlayRuntimeProvider>,
    );

    const modal = screen.UNSAFE_getByType(Modal);
    expect(modal.props.accessibilityLabel).toBe('Project settings');

    const panel = screen.getByTestId('dialog-content');
    expect(panel.props.role).toBeUndefined();
    expect(panel.props['aria-modal']).toBeUndefined();
    expect(panel.props.accessibilityLabel).toBeUndefined();
  });

  it('keeps role="dialog"/aria-modal on the panel itself on native, unaffected', () => {
    setPlatform('ios');
    const screen = render(
      <Dialog defaultOpen>
        <DialogContent testID="dialog-content">
          <DialogTitle>Project settings</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const modal = screen.UNSAFE_getByType(Modal);
    expect(modal.props.accessibilityLabel).toBeUndefined();

    const panel = screen.getByTestId('dialog-content');
    expect(panel.props.role).toBe('dialog');
    expect(panel.props['aria-modal']).toBe(true);
    expect(panel.props.accessibilityLabel).toBe('Project settings');
  });

  it('applies the same Web owner fix to AlertDialog, keeping role="alertdialog" on the panel', () => {
    setPlatform('web');
    const screen = render(
      <OverlayRuntimeProvider>
        <AlertDialog defaultOpen>
          <AlertDialogContent testID="alert-content">
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      </OverlayRuntimeProvider>,
    );

    const modal = screen.UNSAFE_getByType(Modal);
    expect(modal.props.accessibilityLabel).toBe('Delete this project?');

    const panel = screen.getByTestId('alert-content');
    // `dialog` (outer, react-native-web-forced) wrapping `alertdialog`
    // (inner, this panel) are two *different* role values — not the "two
    // nodes with the same role" shape the Web modal-owner fix removes — so
    // `getByRole('dialog')`/`getByRole('alertdialog')` each still resolve to
    // exactly one node.
    expect(panel.props.role).toBe('alertdialog');
    // `aria-modal` stays on the single node that already unavoidably carries
    // it (the react-native-web-forced Modal owner) — not restated here too.
    expect(panel.props['aria-modal']).toBeUndefined();
  });

  it('keeps role="alertdialog" on native too (previously hardcoded to "dialog")', () => {
    setPlatform('ios');
    const screen = render(
      <AlertDialog defaultOpen>
        <AlertDialogContent testID="alert-content">
          <AlertDialogTitle>Delete this project?</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const panel = screen.getByTestId('alert-content');
    expect(panel.props.role).toBe('alertdialog');
    expect(panel.props['aria-modal']).toBe(true);
  });

  /**
   * `UNSAFE_queryAllByProps` matches every fiber carrying a prop, including
   * intermediate composite instances (e.g. `DialogContent` itself, which
   * receives `role` before destructuring it) — counting those would double-
   * or triple-count one real host node. Host `View` elements (`type ===
   * 'View'`) are what actually reach the DOM/native tree, so only counting
   * those gives an accurate "how many real nodes carry this role" answer.
   */
  function countHostViewsWithRole(
    screen: ReturnType<typeof render>,
    role: 'dialog' | 'alertdialog',
  ) {
    return screen.UNSAFE_queryAllByProps({ role }).filter((node) => node.type === View).length;
  }

  it('never stamps role="dialog" on our own tree on Web for a plain Dialog (only react-native-web\'s forced Modal owner does)', () => {
    // This Jest environment renders the real `react-native` `Modal` (a thin
    // composite passthrough), not react-native-web's actual `ModalContent` —
    // it cannot simulate that runtime-injected outer `role="dialog"`/
    // `aria-modal` node itself (that half is Playwright's job, see
    // `apps/visual-regression`). What this file CAN prove deterministically
    // is that BeeUI's own code never adds a second, redundant `role="dialog"`
    // anywhere in its own rendered tree — zero self-inflicted duplicates.
    setPlatform('web');
    const screen = render(
      <OverlayRuntimeProvider>
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Project settings</DialogTitle>
          </DialogContent>
        </Dialog>
      </OverlayRuntimeProvider>,
    );

    expect(countHostViewsWithRole(screen, 'dialog')).toBe(0);
    expect(countHostViewsWithRole(screen, 'alertdialog')).toBe(0);
  });

  it('stamps exactly one role="alertdialog" host node, and no role="dialog" host node, in our own tree for AlertDialog on Web', () => {
    setPlatform('web');
    const screen = render(
      <OverlayRuntimeProvider>
        <AlertDialog defaultOpen>
          <AlertDialogContent>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      </OverlayRuntimeProvider>,
    );

    // `getByRole('dialog')` and `getByRole('alertdialog')` are distinct
    // queries: react-native-web's forced Modal owner will still separately
    // carry the generic `dialog` role at runtime (untestable here — see the
    // note above), so this panel deliberately does not restate it.
    expect(countHostViewsWithRole(screen, 'dialog')).toBe(0);
    expect(countHostViewsWithRole(screen, 'alertdialog')).toBe(1);
  });

  it('clips overflowing content within the rounded panel', () => {
    const screen = render(
      <Dialog defaultOpen>
        <DialogContent testID="dialog-content" />
      </Dialog>,
    );

    expect(screen.getByTestId('dialog-content').props.className).toContain('overflow-hidden');
  });
});
