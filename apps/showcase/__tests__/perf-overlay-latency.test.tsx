import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@beeui/ui';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../packages/ui/src/components/tooltip.native';
import {
  Sheet as SheetWeb,
  SheetContent as SheetContentWeb,
  SheetTitle as SheetTitleWeb,
  SheetTrigger as SheetTriggerWeb,
} from '../../../packages/ui/src/components/sheet.web';
import { clearActiveAnchorSeam, createAnchorSeam } from './helpers/anchor-measurement-seam';
import { sampleWorkloadAsync } from '../perf/sample-workload';
import { writeRawScenarioRecords, type RawScenarioRecord } from '../perf/scenario-recorder';

// Each scenario drives many real mount/open/close cycles through `waitFor`
// (async settling, not a synthetic delay) — well past Jest's 5s default.
jest.setTimeout(120000);

// BeeUI R5.3 (#181) — overlay open-latency benchmarks, extending the #179
// benchmark harness. Measures real trigger-to-visible latency for Dialog,
// Popover, DropdownMenu, Select, Tooltip and Sheet through the actual overlay
// runtime (no bypass of geometry/portal code): press the real trigger, then
// await the SAME resolved/visible state a user-facing assertion would check
// (mounted, non-`aria-hidden`, `pointerEvents !== 'none'`, not the
// invisible-offscreen pre-measurement placeholder these anchored overlays
// render for one tick). This intentionally spans trigger -> portal mount ->
// anchor measurement -> resolved layout, per #181's requirement to include
// those phases, not just a synchronous open-state flag flip.
//
// Cold vs warm: "cold" mounts a fresh component tree per sample (full
// mount + first open + teardown); "warm" mounts once and repeatedly
// opens/closes the SAME tree, isolating steady-state latency from mount cost.
//
// Tooltip uses its immediate focus/blur channel (not long-press) so the
// ADR's fixed reveal-window close timer never confounds the latency signal —
// see `docs/decisions/005-tooltip-contract.md` and
// `issue-153-tooltip-native.test.tsx` for the channel's documented immediacy.
//
// Sheet is measured through `sheet.web` directly (the module Metro's platform
// resolution actually ships for Web builds) rather than the bare `Sheet`
// re-export, which is Jest's native-resolved cross-platform default —
// mirroring `issue-152-tooltip-web.test.tsx`'s same direct-module convention.
// This also gives the one reduced-motion path worth measuring separately:
// `sheet.web` is the only overlay in this repo with an observable
// `prefers-reduced-motion` branch (grepped repo-wide; Dialog/Popover/
// DropdownMenu/Tooltip/Select have none here, so no separate reduced-motion
// scenario is invented for them).

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 640 };
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

const HOST_RECT = { x: 0, y: 0, width: 320, height: 640 };
const ANCHOR_RECT = { x: 80, y: 40, width: 120, height: 40 };

// RN's auto-mock layer under this repo's jest-expo/React 19 combination gives
// `measureInWindow` a silent auto-mock and never routes RTL's `createNodeMock`
// to the real ref a trigger component receives (BeeUI issue #58 — see
// `helpers/anchor-measurement-seam.tsx`'s own header, and
// `anchor-measurement-seam-proof.test.tsx`, the one suite that proves it).
// Every anchored-overlay scenario here uses that same shared seam instead of
// `createNodeMock`, with each trigger component registered as its own capture
// (the mock layer exposes a distinct prototype per product-component path).
function installOverlayAnchorSeam() {
  createAnchorSeam({
    captures: [
      (ref) => (
        <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
          <Popover>
            <PopoverTrigger ref={ref as never} testID="capture-trigger" />
          </Popover>
        </OverlayRuntimeProvider>
      ),
      (ref) => (
        <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
          <DropdownMenu>
            <DropdownMenuTrigger ref={ref as never} testID="capture-trigger" />
          </DropdownMenu>
        </OverlayRuntimeProvider>
      ),
      (ref) => (
        <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
          <Select>
            <SelectTrigger ref={ref as never} testID="capture-trigger" />
          </Select>
        </OverlayRuntimeProvider>
      ),
      (ref) => (
        <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
          <Tooltip>
            <TooltipTrigger ref={ref as never} testID="capture-trigger" />
          </Tooltip>
        </OverlayRuntimeProvider>
      ),
    ],
    match: (testID) => testID === 'trigger',
    rectFor: (testID) => (testID === 'trigger' ? ANCHOR_RECT : undefined),
  });
}

// Anchor resolution also needs the content's OWN measured size, which arrives
// through a `layout` event RN's test renderer never fires on its own (mirrors
// `anchor-measurement-seam-proof.test.tsx`'s single explicit `layout` fire —
// a real device's layout pass, not a repeated poll).
function fireContentLayout(screen: ReturnType<typeof render>, testId: string) {
  const content = screen.queryByTestId(testId, { includeHiddenElements: true });
  if (!content) return;
  fireEvent(content, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 220, height: 160 } } });
}

function isOverlayContentVisible(
  screen: ReturnType<typeof render>,
  testId: string,
): boolean {
  const content = screen.queryByTestId(testId, { includeHiddenElements: true });
  if (!content) return false;
  const style = (StyleSheet.flatten(content.props.style) ?? {}) as { opacity?: number };
  if (style.opacity === 0) return false;
  if (content.props.pointerEvents === 'none') return false;
  if (content.props['aria-hidden'] === true) return false;
  if (content.props.accessibilityElementsHidden === true) return false;
  return true;
}

type OverlayHarness = {
  screen: ReturnType<typeof render>;
  open: () => Promise<void>;
  close: () => Promise<void>;
  isVisible: () => boolean;
};

const records: RawScenarioRecord[] = [];

function record(entry: RawScenarioRecord) {
  records.push(entry);
}

async function benchOverlayCold(
  id: string,
  title: string,
  description: string,
  mount: () => OverlayHarness,
  { warmup = 6, samples = 16 }: { warmup?: number; samples?: number } = {},
) {
  const durations = await sampleWorkloadAsync({
    warmup,
    samples,
    fn: async () => {
      const harness = mount();
      await harness.open();
      if (!harness.isVisible()) throw new Error(`${id}: content did not become visible`);
      harness.screen.unmount();
    },
  });
  record({
    id,
    title,
    platform: 'web',
    unit: 'ms/cold-open',
    description,
    warmup,
    samples,
    iterations: 1,
    candidate: { label: 'beeui', durations },
  });
}

async function benchOverlayWarm(
  id: string,
  title: string,
  description: string,
  mount: () => OverlayHarness,
  { warmup = 6, samples = 16 }: { warmup?: number; samples?: number } = {},
) {
  const harness = mount();
  const durations = await sampleWorkloadAsync({
    warmup,
    samples,
    // Only `open()` is timed — `close()` is an untimed reset between samples,
    // so its cost never pollutes the measured open-latency window.
    fn: async () => {
      await harness.open();
      if (!harness.isVisible()) throw new Error(`${id}: content did not become visible`);
    },
    reset: async () => {
      await harness.close();
    },
  });
  harness.screen.unmount();
  record({
    id,
    title,
    platform: 'web',
    unit: 'ms/warm-open',
    description,
    warmup,
    samples,
    iterations: 1,
    candidate: { label: 'beeui', durations },
  });
}

function mountDialog(): OverlayHarness {
  const screen = render(
    <Dialog>
      <DialogTrigger testID="trigger">Open</DialogTrigger>
      <DialogContent testID="content">
        <DialogTitle>Delete project</DialogTitle>
        <DialogClose testID="close">Close</DialogClose>
      </DialogContent>
    </Dialog>,
  );
  return {
    screen,
    open: async () => {
      await act(async () => {
        fireEvent.press(screen.getByTestId('trigger'));
      });
      await waitFor(() => expect(isOverlayContentVisible(screen, 'content')).toBe(true));
    },
    close: async () => {
      await act(async () => {
        fireEvent.press(screen.getByTestId('close'));
      });
      await waitFor(() => expect(screen.queryByTestId('content')).toBeNull());
    },
    isVisible: () => isOverlayContentVisible(screen, 'content'),
  };
}

function mountPopover(): OverlayHarness {
  const screen = render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
      <Popover>
        <PopoverTrigger testID="trigger">Toggle</PopoverTrigger>
        <PopoverContent testID="content">Info</PopoverContent>
      </Popover>
    </OverlayRuntimeProvider>,
  );
  return {
    screen,
    open: async () => {
      await act(async () => {
        fireEvent.press(screen.getByTestId('trigger'));
      });
      await act(async () => {
        fireContentLayout(screen, 'content');
      });
      await waitFor(() => expect(isOverlayContentVisible(screen, 'content')).toBe(true));
    },
    close: async () => {
      await act(async () => {
        fireEvent.press(screen.getByTestId('trigger'));
      });
      await waitFor(() => expect(isOverlayContentVisible(screen, 'content')).toBe(false));
    },
    isVisible: () => isOverlayContentVisible(screen, 'content'),
  };
}

function mountDropdownMenu(): OverlayHarness {
  const screen = render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
      <DropdownMenu>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
        <DropdownMenuContent testID="content">
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </OverlayRuntimeProvider>,
  );
  return {
    screen,
    open: async () => {
      await act(async () => {
        fireEvent.press(screen.getByTestId('trigger'));
      });
      await act(async () => {
        fireContentLayout(screen, 'content');
      });
      await waitFor(() => expect(isOverlayContentVisible(screen, 'content')).toBe(true));
    },
    close: async () => {
      await act(async () => {
        fireEvent.press(screen.getByTestId('trigger'));
      });
      await waitFor(() => expect(isOverlayContentVisible(screen, 'content')).toBe(false));
    },
    isVisible: () => isOverlayContentVisible(screen, 'content'),
  };
}

function mountTooltip(): OverlayHarness {
  const screen = render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
      <Tooltip>
        <TooltipTrigger testID="trigger">Info</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>
    </OverlayRuntimeProvider>,
  );
  return {
    screen,
    // Focus/blur channel: immediate open AND immediate close per the ADR, so
    // no reveal-window timer confounds the measured latency (see file header).
    open: async () => {
      await act(async () => {
        fireEvent(screen.getByTestId('trigger'), 'focus');
      });
      await waitFor(() =>
        expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy(),
      );
    },
    close: async () => {
      await act(async () => {
        fireEvent(screen.getByTestId('trigger'), 'blur');
      });
      await waitFor(() => expect(screen.queryByTestId('content')).toBeNull());
    },
    isVisible: () => screen.queryByTestId('content', { includeHiddenElements: true }) != null,
  };
}

function mountSelect(): OverlayHarness {
  const screen = render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
      <Select>
        <SelectTrigger testID="trigger">
          <SelectValue placeholder="Choose fruit" />
        </SelectTrigger>
        <SelectContent testID="content">
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>
    </OverlayRuntimeProvider>,
  );
  return {
    screen,
    open: async () => {
      await act(async () => {
        fireEvent.press(screen.getByTestId('trigger'));
      });
      await act(async () => {
        fireContentLayout(screen, 'content');
      });
      await waitFor(() => expect(isOverlayContentVisible(screen, 'content')).toBe(true));
    },
    close: async () => {
      await act(async () => {
        fireEvent.press(screen.getByTestId('trigger'));
      });
      await waitFor(() => expect(isOverlayContentVisible(screen, 'content')).toBe(false));
    },
    isVisible: () => isOverlayContentVisible(screen, 'content'),
  };
}

function mountSheet(reducedMotion: boolean): OverlayHarness {
  (globalThis as { matchMedia?: (query: string) => unknown }).matchMedia = (query: string) => ({
    matches: reducedMotion && query.includes('prefers-reduced-motion'),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });

  const screen = render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
      <SheetWeb>
        <SheetTriggerWeb testID="trigger">Open sheet</SheetTriggerWeb>
        <SheetContentWeb overlayTestID="overlay" testID="content">
          <SheetTitleWeb>Filters</SheetTitleWeb>
        </SheetContentWeb>
      </SheetWeb>
    </OverlayRuntimeProvider>,
  );

  return {
    screen,
    open: async () => {
      await act(async () => {
        fireEvent.press(screen.getByTestId('trigger'));
      });
      await waitFor(() =>
        expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy(),
      );
    },
    // `SheetClose` cannot be used here: it is a child of `SheetContent`'s
    // portaled `children`, which (per `theme-scope.tsx`'s documented legacy
    // overlay-transport fallback — the only host available in this Jest
    // environment) is re-rendered detached from the original fiber tree and
    // loses ancestor React context, including `SheetContext`. Closing via the
    // backdrop (`overlayTestID`) presses a handler `SheetContent` itself
    // owns, so it needs no such context indirection.
    close: async () => {
      await act(async () => {
        fireEvent.press(screen.getByTestId('overlay', { includeHiddenElements: true }));
      });
      await waitFor(() => expect(screen.queryByTestId('content')).toBeNull());
    },
    isVisible: () => screen.queryByTestId('content', { includeHiddenElements: true }) != null,
  };
}

describe('BeeUI #181 overlay open-latency benchmarks', () => {
  beforeEach(() => {
    installOverlayAnchorSeam();
  });

  afterEach(() => {
    clearActiveAnchorSeam();
  });

  afterAll(() => {
    writeRawScenarioRecords('overlay-latency.json', records);
  });

  it('Dialog cold/warm open latency', async () => {
    await benchOverlayCold(
      'web/overlay/dialog-open-cold',
      'Dialog first-open latency (cold)',
      'Fresh Dialog mount, trigger press to resolved-visible content, per sample.',
      mountDialog,
    );
    await benchOverlayWarm(
      'web/overlay/dialog-open-warm',
      'Dialog steady-state open latency (warm)',
      'One Dialog mount reused across samples; trigger press to resolved-visible content, then close, per sample.',
      mountDialog,
    );
  });

  it('Popover cold/warm open latency', async () => {
    await benchOverlayCold(
      'web/overlay/popover-open-cold',
      'Popover first-open latency (cold)',
      'Fresh Popover mount, trigger press to resolved (measured/positioned, non-hidden) content, per sample.',
      mountPopover,
    );
    await benchOverlayWarm(
      'web/overlay/popover-open-warm',
      'Popover steady-state open latency (warm)',
      'One Popover mount reused across samples; trigger toggled open then closed, per sample.',
      mountPopover,
    );
  });

  it('DropdownMenu cold/warm open latency', async () => {
    await benchOverlayCold(
      'web/overlay/dropdown-menu-open-cold',
      'DropdownMenu first-open latency (cold)',
      'Fresh DropdownMenu mount, trigger press to resolved content, per sample.',
      mountDropdownMenu,
    );
    await benchOverlayWarm(
      'web/overlay/dropdown-menu-open-warm',
      'DropdownMenu steady-state open latency (warm)',
      'One DropdownMenu mount reused across samples; trigger toggled open then closed, per sample.',
      mountDropdownMenu,
    );
  });

  it('Select cold/warm open latency', async () => {
    await benchOverlayCold(
      'web/overlay/select-open-cold',
      'Select first-open latency (cold)',
      'Fresh Select mount, trigger press to resolved (measured/positioned) content, per sample.',
      mountSelect,
      { warmup: 4, samples: 12 },
    );
    await benchOverlayWarm(
      'web/overlay/select-open-warm',
      'Select steady-state open latency (warm)',
      'One Select mount reused across samples; trigger toggled open then closed, per sample.',
      mountSelect,
      { warmup: 4, samples: 12 },
    );
  });

  it('Tooltip cold/warm open latency (focus channel)', async () => {
    await benchOverlayCold(
      'web/overlay/tooltip-open-cold',
      'Tooltip first-open latency (cold, focus channel)',
      'Fresh Tooltip mount, focus event to visible content, per sample. Uses the immediate focus channel, not long-press, to avoid the reveal-window close timer confounding latency.',
      mountTooltip,
    );
    await benchOverlayWarm(
      'web/overlay/tooltip-open-warm',
      'Tooltip steady-state open latency (warm, focus channel)',
      'One Tooltip mount reused across samples; focus then blur, per sample.',
      mountTooltip,
    );
  });

  it('Sheet cold open latency (default motion) and a reduced-motion variant', async () => {
    await benchOverlayCold(
      'web/overlay/sheet-open-cold',
      'Sheet first-open latency (cold, default motion)',
      'Fresh sheet.web mount, trigger press to visible content, per sample, with the default (non-reduced) motion path.',
      () => mountSheet(false),
    );
    await benchOverlayCold(
      'web/overlay/sheet-open-cold-reduced-motion',
      'Sheet first-open latency (cold, reduced motion)',
      'Same as the cold sheet.web scenario, with `prefers-reduced-motion: reduce` forced true — sheet.web is the one overlay in this repo with an observable reduced-motion branch (see file header).',
      () => mountSheet(true),
    );
  });

  // No default-motion warm scenario: `sheet.web`'s exit animation unmounts
  // content only after its `Animated.timing` completion callback fires, which
  // depends on this Jest environment actually driving `requestAnimationFrame`
  // to completion — it does not (same class of environment gap the file
  // header notes for Tooltip's reveal-window timer, and the reason that
  // scenario uses the immediate focus/blur channel instead). The
  // reduced-motion path resolves both open AND close synchronously
  // (`resolveNativeMotion` returns `{ type: 'immediate' }`), so it is the one
  // honest way to measure a repeated open/close cycle here.
  it('Sheet steady-state open latency (warm, reduced motion)', async () => {
    await benchOverlayWarm(
      'web/overlay/sheet-open-warm-reduced-motion',
      'Sheet steady-state open latency (warm, reduced motion)',
      'One sheet.web mount reused across samples; trigger press then backdrop close, per sample, via the immediate reduced-motion path (see comment above for why default motion cannot be measured warm in this environment).',
      () => mountSheet(true),
    );
  });
});
