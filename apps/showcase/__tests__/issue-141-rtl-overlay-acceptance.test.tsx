import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@beemvp/beeui-ui';
import { render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import * as directionModule from '../../../packages/ui/src/components/use-direction';

// #141 (R3.3, RTL overlay acceptance) — deterministic contract evidence closing a
// gap ADR-004/#140 left open: `apps/showcase/__tests__/logical-direction.test.tsx`
// only proves `Popover` calls the shared direction resolver (ADR-004's "overlay
// direction consolidation"). `DropdownMenu`, `Select`, and `Tooltip` call the exact
// same `resolveDirection()` default (`dropdown-menu.tsx:250`, `select.tsx:504`,
// `tooltip.native.tsx:134`) but were never independently proven to actually do so —
// a component could silently regress to a duplicated inline `I18nManager.isRTL`
// ternary (the pre-ADR-004 state) without any test catching it. This file proves,
// per component, both precedence-1 seams:
//   1. no explicit `direction` prop -> the shared resolver is consulted (ambient
//      wins by falling through to it);
//   2. an explicit `direction` prop -> the resolver is never called (explicit
//      always wins, ADR-004 precedence 1).
// This is "deterministic contract evidence" (docs/beeui-1.0-evidence-classes.md),
// not real per-platform native runtime evidence — that class requires a named
// iOS Simulator/Android Emulator run, out of scope for a Jest/RNTL environment.

jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 300, height: 200 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactLocal.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) =>
        ReactLocal.createElement(View, { ref, ...props }, children),
    ),
    useSafeAreaInsets: () => insets,
  };
});

const HOST_RECT = { x: 0, y: 0, width: 300, height: 200 };
const ANCHOR = { x: 100, y: 60, width: 40, height: 20 };

function renderInHost(children: React.ReactNode) {
  return render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>,
    {
      createNodeMock: (element) => {
        const testID = (element.props as { testID?: string })?.testID;
        if (testID !== 'trigger') return null;
        return {
          measureInWindow: (
            callback: (x: number, y: number, width: number, height: number) => void,
          ) => callback(ANCHOR.x, ANCHOR.y, ANCHOR.width, ANCHOR.height),
        };
      },
    },
  );
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DropdownMenu direction consolidation (#141)', () => {
  it('resolves the ambient direction via the shared resolver when no direction prop is given', async () => {
    const spy = jest.spyOn(directionModule, 'resolveDirection');
    const screen = renderInHost(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="trigger">Open</DropdownMenuTrigger>
        <DropdownMenuContent testID="content">
          <React.Fragment />
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy(),
    );
    expect(spy).toHaveBeenCalled();
  });

  it('does not call the resolver when an explicit direction prop is supplied', async () => {
    const spy = jest.spyOn(directionModule, 'resolveDirection');
    const screen = renderInHost(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="trigger">Open</DropdownMenuTrigger>
        <DropdownMenuContent direction="rtl" testID="content">
          <React.Fragment />
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy(),
    );
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('Select direction consolidation (#141)', () => {
  it('resolves the ambient direction via the shared resolver when no direction prop is given', async () => {
    const spy = jest.spyOn(directionModule, 'resolveDirection');
    const screen = renderInHost(
      <Select defaultOpen>
        <SelectTrigger testID="trigger">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent testID="content" />
      </Select>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy(),
    );
    expect(spy).toHaveBeenCalled();
  });

  it('does not call the resolver when an explicit direction prop is supplied', async () => {
    const spy = jest.spyOn(directionModule, 'resolveDirection');
    const screen = renderInHost(
      <Select defaultOpen>
        <SelectTrigger testID="trigger">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent direction="rtl" testID="content" />
      </Select>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy(),
    );
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('Tooltip direction consolidation (#141)', () => {
  it('resolves the ambient direction via the shared resolver when no direction prop is given', async () => {
    const spy = jest.spyOn(directionModule, 'resolveDirection');
    const screen = renderInHost(
      <Tooltip defaultOpen>
        <TooltipTrigger testID="trigger">Open</TooltipTrigger>
        <TooltipContent testID="content">Description</TooltipContent>
      </Tooltip>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy(),
    );
    expect(spy).toHaveBeenCalled();
  });

  it('does not call the resolver when an explicit direction prop is supplied', async () => {
    const spy = jest.spyOn(directionModule, 'resolveDirection');
    const screen = renderInHost(
      <Tooltip defaultOpen>
        <TooltipTrigger testID="trigger">Open</TooltipTrigger>
        <TooltipContent direction="rtl" testID="content">
          Description
        </TooltipContent>
      </Tooltip>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy(),
    );
    expect(spy).not.toHaveBeenCalled();
  });
});
