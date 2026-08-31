import {
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
  Skeleton,
} from '@beemvp/beeui-ui';
import { act, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { AccessibilityInfo, Modal } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../packages/ui/src/components/tooltip.native';

// BeeUI issue #149 (R3.11) — cross-cutting reduced-motion acceptance sweep.
//
// This is the deterministic-contract half of #149's native evidence. Per
// `docs/motion.md`, BeeUI reads the ambient reduced-motion signal
// (`AccessibilityInfo.isReduceMotionEnabled()`/`reduceMotionChanged`) rather
// than owning a second preference store, the same contract `sheet.native.tsx`
// already proves (`issue-160-sheet-runtime-acceptance.test.tsx` "reduced-motion
// mapping"). This file covers the rest of the animated/anchored-overlay
// surface `docs/accessibility-contract.md` names as open for #149:
//
//   - Dialog/AlertDialog: a genuine gap this change fixes. React Native Web's
//     `Modal`/`ModalAnimation` applies its `fade`/`slide` CSS keyframe
//     unconditionally (verified against `react-native-web@0.21.0` source: it
//     never itself reads `prefers-reduced-motion`), so `DialogContent` now
//     composes the ambient signal into its own `animationType` default
//     (`none` when reduced motion is on, `fade` otherwise) instead of always
//     forcing the same ~300ms transition. `fade` has no spatial component,
//     so this was never a "no mandatory spatial animation" violation, but it
//     did not honor the user's preference either.
//   - Popover/DropdownMenu: verified by source inspection (no `Animated`
//     import, no CSS transition class, no RN core `Modal`) to run no
//     enter/exit transition of their own — the same "nothing to gate"
//     rationale `docs/accessibility-contract.md` already states for Tooltip.
//     Proven here rather than merely asserted: content mounts synchronously
//     regardless of the ambient signal.
//   - Tooltip (native): already documented as having no transition of its
//     own; proven here for the native long-press/focus channel specifically
//     (Web's channel already has real browser evidence in
//     `tooltip-showcase.spec.ts`).
//   - Skeleton: a static regression guard — `Skeleton` currently ships no
//     `animate-*` utility class at all, so there is nothing to gate under
//     reduced motion. This test fails on purpose if a future change adds one
//     without also adding reduced-motion handling.
//
// Select and the remaining DropdownMenu/Popover interaction matrix already
// have extensive native deterministic coverage elsewhere (`wave-2a-select-
// *.test.tsx`, `issue-36-dropdown-menu.test.tsx`, `issue-21-popover.test.tsx`,
// `overlay-runtime-hardening.test.tsx`) that already exercises synchronous
// open/close with no `Animated`/motion-token dependency; this file does not
// duplicate that ground.

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 300, height: 200 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <View ref={ref} {...props}>
          {children}
        </View>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

const HOST_RECT = { x: 0, y: 0, width: 300, height: 200 };
const ANCHOR_RECT = { x: 100, y: 60, width: 40, height: 20 };

const anchorNodeMock = (element: { props?: { testID?: string } }) => {
  if (!/anchor$|trigger$/.test(element.props?.testID ?? '')) return null;
  return {
    measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
      cb(ANCHOR_RECT.x, ANCHOR_RECT.y, ANCHOR_RECT.width, ANCHOR_RECT.height),
  };
};

function renderRoot(ui: React.ReactNode) {
  return render(<OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{ui}</OverlayRuntimeProvider>, {
    createNodeMock: anchorNodeMock,
  });
}

/** Mirrors `issue-160-sheet-runtime-acceptance.test.tsx`'s own signal mock. */
function mockReducedMotionSignal(enabled: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(enabled);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({
    remove: () => undefined,
  } as ReturnType<typeof AccessibilityInfo.addEventListener>);
}

/** Flushes the pending `isReduceMotionEnabled()` microtask inside `act()`. */
async function flushReducedMotionSignal() {
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BeeUI issue #149 reduced-motion acceptance', () => {
  describe('Dialog/AlertDialog — animationType composes the ambient reduced-motion signal', () => {
    it('defaults to animationType="none" when reduced motion is enabled', async () => {
      mockReducedMotionSignal(true);
      const screen = renderRoot(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Project settings</DialogTitle>
          </DialogContent>
        </Dialog>,
      );
      await flushReducedMotionSignal();

      expect(screen.UNSAFE_getByType(Modal).props.animationType).toBe('none');
    });

    it('defaults to animationType="fade" when reduced motion is disabled', async () => {
      mockReducedMotionSignal(false);
      const screen = renderRoot(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Project settings</DialogTitle>
          </DialogContent>
        </Dialog>,
      );
      await flushReducedMotionSignal();

      expect(screen.UNSAFE_getByType(Modal).props.animationType).toBe('fade');
    });

    it('never overrides an explicit modalProps.animationType, regardless of the reduced-motion signal', async () => {
      mockReducedMotionSignal(true);
      const screen = renderRoot(
        <Dialog defaultOpen>
          <DialogContent modalProps={{ animationType: 'slide' }}>
            <DialogTitle>Project settings</DialogTitle>
          </DialogContent>
        </Dialog>,
      );
      await flushReducedMotionSignal();

      expect(screen.UNSAFE_getByType(Modal).props.animationType).toBe('slide');
    });

    it('updates the resolved default live when the ambient signal changes while mounted', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      let changeListener: ((value: boolean) => void) | undefined;
      jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(
        ((_event: string, listener: (value: boolean) => void) => {
          changeListener = listener;
          return { remove: () => { changeListener = undefined; } };
        }) as typeof AccessibilityInfo.addEventListener,
      );

      const screen = renderRoot(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Project settings</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      await waitFor(() => expect(screen.UNSAFE_getByType(Modal).props.animationType).toBe('fade'));

      await act(async () => changeListener?.(true));
      expect(screen.UNSAFE_getByType(Modal).props.animationType).toBe('none');
    });
  });

  describe('Popover/DropdownMenu — no enter/exit transition to gate', () => {
    it.each([true, false])(
      'Popover content mounts synchronously regardless of the reduced-motion signal (reduced=%s)',
      async (reducedMotion) => {
        mockReducedMotionSignal(reducedMotion);
        const screen = renderRoot(
          <Popover defaultOpen>
            <PopoverTrigger testID="popover-trigger">Open</PopoverTrigger>
            <PopoverContent>
              <PopoverTitle testID="popover-title">Details</PopoverTitle>
            </PopoverContent>
          </Popover>,
        );
        await flushReducedMotionSignal();

        expect(screen.getByTestId('popover-title', { includeHiddenElements: true })).toBeTruthy();
      },
    );

    it.each([true, false])(
      'DropdownMenu content mounts synchronously regardless of the reduced-motion signal (reduced=%s)',
      async (reducedMotion) => {
        mockReducedMotionSignal(reducedMotion);
        const screen = renderRoot(
          <DropdownMenu defaultOpen>
            <DropdownMenuTrigger testID="menu-trigger">Menu</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem testID="menu-item">Select</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>,
        );
        await flushReducedMotionSignal();

        expect(screen.getByTestId('menu-item', { includeHiddenElements: true })).toBeTruthy();
      },
    );
  });

  describe('Tooltip (native) — long-press/focus reveal has nothing motion-specific to gate', () => {
    it.each([true, false])(
      'reveals content synchronously regardless of the reduced-motion signal (reduced=%s)',
      async (reducedMotion) => {
        mockReducedMotionSignal(reducedMotion);
        const screen = renderRoot(
          <Tooltip defaultOpen>
            <TooltipTrigger testID="tooltip-trigger">Autosave</TooltipTrigger>
            <TooltipContent testID="tooltip-content">Saved automatically</TooltipContent>
          </Tooltip>,
        );
        await flushReducedMotionSignal();

        expect(screen.getByTestId('tooltip-content', { includeHiddenElements: true })).toBeTruthy();
      },
    );
  });

  describe('Skeleton — regression guard', () => {
    it('ships no animate-* utility class (nothing to gate under reduced motion)', () => {
      const screen = render(<Skeleton testID="skeleton" />);
      const node = screen.getByTestId('skeleton', { includeHiddenElements: true });
      expect(String(node.props.className ?? '')).not.toMatch(/animate-/);
    });
  });
});
