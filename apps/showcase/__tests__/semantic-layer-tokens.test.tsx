import {
  BeeUIProvider,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useToast,
  type ToastApi,
} from '@beeui/ui';
import { layer, layerVariable } from '@beeui/tokens';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import * as fs from 'node:fs';
import * as path from 'node:path';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 480 };

  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: React.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof View>) => (
        <View ref={ref} {...props}>
          {children}
        </View>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

const HOST_RECT = { x: 0, y: 0, width: 320, height: 480 };
const DEFAULT_ANCHOR = { x: 80, y: 40, width: 80, height: 40 };

type Rect = typeof DEFAULT_ANCHOR;

function componentSource(relativePath: string) {
  return fs.readFileSync(path.resolve(__dirname, '../../../packages/ui/src/components', relativePath), 'utf8');
}

function flattenZIndex(node: { props: { style?: unknown } }): number | undefined {
  return (StyleSheet.flatten(node.props.style) as { zIndex?: number } | undefined)?.zIndex;
}

function renderInOverlayRuntime(
  children: React.ReactNode,
  anchorRects: Record<string, Rect> = { trigger: DEFAULT_ANCHOR },
) {
  return render(<OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>, {
    createNodeMock: (element) => {
      const testID = (element.props as { testID?: string })?.testID;
      const rect = testID ? anchorRects[testID] : undefined;
      if (rect) {
        return {
          focus: jest.fn(),
          measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
            callback(rect.x, rect.y, rect.width, rect.height),
        };
      }
      if (testID) return { focus: jest.fn() };
      return null;
    },
  });
}

describe('semantic layer token contract (#73)', () => {
  it('exposes exactly the evidence-based z-order vocabulary in intent order', () => {
    expect(Object.keys(layer)).toEqual(['base', 'overlay', 'toast']);
    expect(layer).toEqual({ base: 0, overlay: 100, toast: 1000 });
  });

  it('encodes a strictly ascending, base-zero scale so base < overlay < toast', () => {
    expect(layer.base).toBe(0);
    expect(layer.overlay).toBeGreaterThan(layer.base);
    expect(layer.toast).toBeGreaterThan(layer.overlay);
  });

  it('leaves intentional numeric gaps for apps to insert local sublayers without collision', () => {
    // A local sticky header (base < x < overlay) and tooltip (x > toast) must fit
    // between BeeUI roles without colliding with any reserved value.
    const reserved = new Set(Object.values(layer));
    expect(reserved.has(50)).toBe(false); // e.g. app sticky header
    expect(reserved.has(500)).toBe(false); // e.g. app modal scrim
    expect(reserved.has(1100)).toBe(false); // e.g. app tooltip
    expect(layer.overlay - layer.base).toBeGreaterThanOrEqual(2);
    expect(layer.toast - layer.overlay).toBeGreaterThanOrEqual(2);
  });

  it('derives typed CSS variable names for web/Uniwind consumers', () => {
    expect(layerVariable('base')).toBe('--layer-base');
    expect(layerVariable('overlay')).toBe('--layer-overlay');
    expect(layerVariable('toast')).toBe('--layer-toast');
  });
});

describe('reusable components consume the semantic layer contract (#73)', () => {
  const overlayRuntime = componentSource('overlay-runtime.tsx');
  const popover = componentSource('popover.tsx');
  const select = componentSource('select.tsx');
  const dropdown = componentSource('dropdown-menu.tsx');
  const toast = componentSource('toast.tsx');

  it('routes anchored overlay surfaces through layer.overlay', () => {
    for (const src of [overlayRuntime, popover, select, dropdown]) {
      expect(src).toContain("import { layer } from '@beeui/tokens';");
      expect(src).toContain('zIndex: layer.overlay');
    }
  });

  it('routes the toast viewport through layer.toast for both zIndex and Android draw order', () => {
    expect(toast).toContain("import { layer } from '@beeui/tokens';");
    expect(toast).toContain('zIndex: layer.toast');
    expect(toast).toContain('elevation: layer.toast');
  });

  it('no longer hardcodes the migrated arbitrary z-index literals', () => {
    for (const src of [overlayRuntime, popover, select, dropdown]) {
      expect(src).not.toMatch(/zIndex:\s*1\b/);
    }
    expect(toast).not.toMatch(/zIndex:\s*1000\b/);
    expect(toast).not.toMatch(/elevation:\s*1000\b/);
  });
});

describe('semantic layer coexistence and stacking (#73)', () => {
  function CaptureToast({ capture }: { capture: (api: ToastApi) => void }) {
    capture(useToast());
    return null;
  }

  it('stacks a persistent header, the overlay host, and the toast viewport in deterministic order', () => {
    let api: ToastApi | null = null;
    const screen = render(
      <BeeUIProvider syncUniwindInsets={false}>
        {/* A persistent/base surface uses no z-index token: it is the ground plane. */}
        <View testID="app-header">
          <Text>Header</Text>
        </View>
        <CaptureToast capture={(value) => { api = value; }} />
      </BeeUIProvider>,
    );
    if (!api) throw new Error('Toast API was not captured');

    act(() => {
      (api as ToastApi).show({ title: 'Saved' });
    });

    const host = screen.getByTestId('beeui-overlay-host');
    const viewport = screen.getByTestId('beeui-toast-viewport');

    expect(flattenZIndex(host)).toBe(layer.overlay);
    expect(flattenZIndex(viewport)).toBe(layer.toast);
    // Deterministic visible stacking: base(0) < overlay host < toast viewport.
    expect(layer.base).toBeLessThan(flattenZIndex(host) as number);
    expect(flattenZIndex(host) as number).toBeLessThan(flattenZIndex(viewport) as number);
  });

  it('renders coexisting anchored Popover and Dropdown surfaces on the shared overlay layer', async () => {
    const screen = renderInOverlayRuntime(
      <>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
          <DropdownMenuContent testID="menu-content">
            <DropdownMenuItem testID="menu-item">Edit</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover defaultOpen>
          <PopoverTrigger testID="popover-trigger">Info</PopoverTrigger>
          <PopoverContent testID="popover-content">
            <Text>Details</Text>
          </PopoverContent>
        </Popover>
      </>,
      { trigger: DEFAULT_ANCHOR, 'popover-trigger': { x: 160, y: 40, width: 80, height: 40 } },
    );

    const menu = await waitFor(() =>
      screen.getByTestId('menu-content', { includeHiddenElements: true }),
    );
    const popover = await waitFor(() =>
      screen.getByTestId('popover-content', { includeHiddenElements: true }),
    );

    // Both anchored surfaces resolve to the same semantic overlay layer; their
    // relative paint order is decided by portal/DOM order, not competing z values.
    expect(flattenZIndex(menu)).toBe(layer.overlay);
    expect(flattenZIndex(popover)).toBe(layer.overlay);
  });

  it('keeps Escape dismissal behavior unchanged for a migrated anchored overlay', async () => {
    const onOpenChange = jest.fn();
    const screen = renderInOverlayRuntime(
      <DropdownMenu defaultOpen onOpenChange={onOpenChange}>
        <DropdownMenuTrigger testID="trigger">Actions</DropdownMenuTrigger>
        <DropdownMenuContent testID="content">
          <DropdownMenuItem testID="item">Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const content = await waitFor(() =>
      screen.getByTestId('content', { includeHiddenElements: true }),
    );
    // Migration is observable at runtime, not just in source.
    expect(flattenZIndex(content)).toBe(layer.overlay);

    fireEvent(content, 'accessibilityEscape');
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
