import {
  Breadcrumb,
  BreadcrumbItem,
  DialogTitle,
  MetadataRow,
  Pagination,
  PaginationItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@beeui/ui';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { I18nManager, Platform } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import * as directionModule from '../../../packages/ui/src/components/use-direction';

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

const {
  readAmbientDirection,
  resolveDirection,
} = directionModule;

// ---------------------------------------------------------------------------
// Ambient toggles. Direction-consuming components read the real platform
// authority (`Platform.OS` + `I18nManager.isRTL`) through the shared resolver;
// jest-expo defaults `Platform.OS` to a native value, so these toggles exercise
// the native ambient branch deterministically without touching global DOM state.
// ---------------------------------------------------------------------------
const originalIsRTL = I18nManager.isRTL;
const originalPlatformOS = Platform.OS;

function setNativeRTL(isRTL: boolean) {
  Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: isRTL });
}

afterEach(() => {
  Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: originalIsRTL });
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  jest.restoreAllMocks();
});

// ===========================================================================
// 1. Shared resolver precedence (ADR-004 direction source precedence).
//    Uses injected ambient inputs, so precedence is proven without mutating
//    global platform state. Load-bearing: reverting the precedence order or the
//    Web `document.dir` read (the fix the overlay consolidation delivers over
//    the old native-only inline ternary) fails these.
// ===========================================================================
describe('resolveDirection / readAmbientDirection precedence', () => {
  it('lets an explicit value win over the ambient authority (precedence 1)', () => {
    expect(resolveDirection('rtl', { platformOS: 'ios', nativeIsRTL: false })).toBe('rtl');
    expect(resolveDirection('ltr', { platformOS: 'ios', nativeIsRTL: true })).toBe('ltr');
    expect(resolveDirection('rtl', { platformOS: 'web', webDocumentDir: 'ltr' })).toBe('rtl');
  });

  it('reads I18nManager.isRTL on native (precedence 2a)', () => {
    expect(readAmbientDirection({ platformOS: 'ios', nativeIsRTL: true })).toBe('rtl');
    expect(readAmbientDirection({ platformOS: 'android', nativeIsRTL: false })).toBe('ltr');
  });

  it('reads document.documentElement.dir on Web, not the native flag (precedence 2b)', () => {
    expect(readAmbientDirection({ platformOS: 'web', webDocumentDir: 'rtl' })).toBe('rtl');
    expect(readAmbientDirection({ platformOS: 'web', webDocumentDir: 'ltr' })).toBe('ltr');
    // Web ignores the native flag entirely: an RTL native flag must not leak into
    // the Web branch, and an LTR `dir` must not be overridden by it.
    expect(
      readAmbientDirection({ platformOS: 'web', webDocumentDir: 'ltr', nativeIsRTL: true }),
    ).toBe('ltr');
  });

  it('ignores the Web dir on native and falls back to ltr (precedence 3)', () => {
    // Native branch never consults webDocumentDir.
    expect(
      readAmbientDirection({ platformOS: 'ios', nativeIsRTL: false, webDocumentDir: 'rtl' }),
    ).toBe('ltr');
    // Web with an absent/empty dir falls back to ltr.
    expect(readAmbientDirection({ platformOS: 'web', webDocumentDir: null })).toBe('ltr');
    expect(readAmbientDirection({ platformOS: 'web', webDocumentDir: '' })).toBe('ltr');
  });
});

// ===========================================================================
// 2. Overlay consolidation: Popover/DropdownMenu/Select default their direction
//    through the shared resolver instead of a duplicated inline ternary.
//    Load-bearing: reverting an overlay to `I18nManager.isRTL ? 'rtl' : 'ltr'`
//    stops calling resolveDirection -> the "no explicit prop" spy assertion fails;
//    and the explicit-prop assertion guards precedence 1.
// ===========================================================================
describe('overlay direction consolidation', () => {
  const HOST_RECT = { x: 0, y: 0, width: 300, height: 200 };
  const ANCHOR = { x: 100, y: 60, width: 40, height: 20 };

  function renderPopover(children: React.ReactNode) {
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

  it('resolves the ambient direction via the shared resolver when no direction prop is given', async () => {
    const spy = jest.spyOn(directionModule, 'resolveDirection');
    const screen = renderPopover(
      <Popover defaultOpen>
        <PopoverTrigger testID="trigger">Open</PopoverTrigger>
        <PopoverContent testID="content">
          <React.Fragment />
        </PopoverContent>
      </Popover>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy(),
    );
    expect(spy).toHaveBeenCalled();
  });

  it('does not call the resolver when an explicit direction prop is supplied (explicit wins)', async () => {
    const spy = jest.spyOn(directionModule, 'resolveDirection');
    const screen = renderPopover(
      <Popover defaultOpen>
        <PopoverTrigger testID="trigger">Open</PopoverTrigger>
        <PopoverContent testID="content" direction="rtl">
          <React.Fragment />
        </PopoverContent>
      </Popover>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('content', { includeHiddenElements: true })).toBeTruthy(),
    );
    expect(spy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 3. Pagination previous/next chevrons mirror with direction.
//    Load-bearing: reverting to hardcoded '‹'/'›' fails the RTL expectations.
// ===========================================================================
describe('Pagination directional chevrons', () => {
  function renderNav(type: 'previous' | 'next') {
    return render(
      <Pagination page={2} pageCount={5}>
        <PaginationItem testID={`nav-${type}`} type={type} />
      </Pagination>,
    );
  }

  it('points previous toward the start (‹) and next toward the end (›) in LTR', () => {
    setNativeRTL(false);
    expect(renderNav('previous').getByText('‹')).toBeTruthy();
    expect(renderNav('next').getByText('›')).toBeTruthy();
  });

  it('mirrors to previous (›) and next (‹) in RTL', () => {
    setNativeRTL(true);
    expect(renderNav('previous').getByText('›')).toBeTruthy();
    expect(renderNav('next').getByText('‹')).toBeTruthy();
    // The physical LTR glyphs must be gone in RTL.
    expect(renderNav('previous').queryByText('‹')).toBeNull();
    expect(renderNav('next').queryByText('›')).toBeNull();
  });
});

// ===========================================================================
// 4. Breadcrumb default separator mirrors with direction; explicit respected.
//    Load-bearing: reverting to the fixed '›' default fails the RTL expectation.
// ===========================================================================
describe('Breadcrumb directional separator', () => {
  function renderCrumbs(separator?: React.ReactNode) {
    return render(
      <Breadcrumb separator={separator}>
        <BreadcrumbItem>Home</BreadcrumbItem>
        <BreadcrumbItem current>Details</BreadcrumbItem>
      </Breadcrumb>,
    );
  }

  // Separators are intentionally hidden from the accessibility tree, so these
  // queries must include hidden elements.
  const opts = { includeHiddenElements: true } as const;

  it('defaults the separator to › in LTR and ‹ in RTL', () => {
    setNativeRTL(false);
    expect(renderCrumbs().getByText('›', opts)).toBeTruthy();

    setNativeRTL(true);
    const rtl = renderCrumbs();
    expect(rtl.getByText('‹', opts)).toBeTruthy();
    expect(rtl.queryByText('›', opts)).toBeNull();
  });

  it('respects an explicit separator unchanged in RTL', () => {
    setNativeRTL(true);
    const screen = renderCrumbs('/');
    expect(screen.getByText('/', opts)).toBeTruthy();
    expect(screen.queryByText('‹', opts)).toBeNull();
  });
});

// ===========================================================================
// 5. Logical alignment/spacing utilities (className), asserted on the rendered
//    host node. uniwind is mocked in Jest, so these pin the logical utility
//    name; the runtime RTL flip is proven by the visual-web CI gate.
//    Load-bearing: reverting to the physical utility fails the assertions.
// ===========================================================================
describe('logical alignment and spacing utilities', () => {
  it('MetadataRow value uses logical text-end, not physical text-right', () => {
    const screen = render(<MetadataRow label="Label" value="Value" />);
    const valueNode = screen.getByText('Value');
    expect(valueNode.props.className).toContain('text-end');
    expect(valueNode.props.className).not.toContain('text-right');
  });

  it('DialogTitle reserves trailing space with logical pe-8, not physical pr-8', () => {
    const screen = render(<DialogTitle>Title</DialogTitle>);
    const titleNode = screen.getByText('Title');
    expect(titleNode.props.className).toContain('pe-8');
    expect(titleNode.props.className).not.toContain('pr-8');
  });
});
