import { defineThemeRegistry } from '@beeui/tokens';
import * as BeeThemeScopeModule from '../../../packages/ui/src/components/theme-scope';
import { BeeThemeScope } from '@beeui/ui';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@beeui/ui';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Pressable, Text, UIManager } from 'react-native';
import { Uniwind, useUniwind } from 'uniwind';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
import {
  createLegacyStoreTransport,
  type OverlayTransport,
} from '../../../packages/ui/src/components/overlay-transport-shared';

// A third brand, defined the way an external consumer would (mirrors
// issue-67-theme-registry.test.tsx) — proves BeeThemeScope works with any
// registry produced by `defineThemeRegistry`, not just `beeThemeRegistry`.
const acmeRegistry = defineThemeRegistry({
  bee: { light: 'light', dark: 'dark' },
  violet: { light: 'violet-light', dark: 'violet-dark' },
  acme: { light: 'acme-light', dark: 'acme-dark' },
});

function ThemeProbe({ testID }: { testID: string }) {
  const { theme } = useUniwind();
  return <Text testID={testID}>{theme}</Text>;
}

jest.mock('react-native-teleport', () => {
  const React = require('react');
  return {
    PortalProvider: ({ children }: { children?: React.ReactNode }) => children,
    PortalHost: () => null,
    Portal: ({ children }: { children?: React.ReactNode }) => children,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
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

const HOST_RECT = { x: 0, y: 0, width: 300, height: 200 };
const ANCHOR_RECT = { x: 100, y: 60, width: 40, height: 20 };

function renderOverlay(ui: React.ReactNode, transport?: OverlayTransport) {
  return render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT} transport={transport}>
      {ui}
    </OverlayRuntimeProvider>,
    {
      createNodeMock: (element) => {
        if (!/trigger$/.test(element.props?.testID ?? '')) return null;
        return {
          measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
            cb(ANCHOR_RECT.x, ANCHOR_RECT.y, ANCHOR_RECT.width, ANCHOR_RECT.height),
        };
      },
    },
  );
}

const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;

function setTeleportAvailable(available: boolean) {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = available ? {} : undefined;
  jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(available);
}

afterEach(() => {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
  jest.restoreAllMocks();
  Uniwind.setTheme('light');
});

describe('issue #68 — BeeThemeScope registry selection', () => {
  it('resolves the default beeThemeRegistry brand + appearance to a runtime theme', () => {
    const screen = render(
      <BeeThemeScope appearance="dark" brand="violet">
        <ThemeProbe testID="probe" />
      </BeeThemeScope>,
    );
    expect(screen.getByTestId('probe').props.children).toBe('violet-dark');
  });

  it('resolves an already-resolved runtime-theme name (the theme form)', () => {
    const screen = render(
      <BeeThemeScope theme="violet-light">
        <ThemeProbe testID="probe" />
      </BeeThemeScope>,
    );
    expect(screen.getByTestId('probe').props.children).toBe('violet-light');
  });

  it('resolves a consumer-defined registry brand from #67 without editing BeeUI source', () => {
    const screen = render(
      <BeeThemeScope appearance="dark" brand="acme" registry={acmeRegistry}>
        <ThemeProbe testID="probe" />
      </BeeThemeScope>,
    );
    expect(screen.getByTestId('probe').props.children).toBe('acme-dark');
  });

  it('throws deterministically for an unknown brand/appearance instead of silently falling back', () => {
    // registry.resolve() throws for an unknown brand (see defineThemeRegistry, #67);
    // BeeThemeScope relies on that behavior rather than duplicating it.
    expect(() =>
      render(
        // @ts-expect-error - intentionally unknown brand for the runtime-behavior test.
        <BeeThemeScope appearance="dark" brand="not-a-brand">
          <ThemeProbe testID="probe" />
        </BeeThemeScope>,
      ),
    ).toThrow(/unknown brand/);
  });

  it('throws deterministically for a resolved-name selection unknown to the registry', () => {
    expect(() =>
      render(
        // @ts-expect-error - intentionally unknown runtime-theme name for the test.
        <BeeThemeScope theme="not-a-runtime-theme">
          <ThemeProbe testID="probe" />
        </BeeThemeScope>,
      ),
    ).toThrow(/is not a runtime-theme name known to the supplied registry/);
  });

  it('exposes only the component from the package barrel — no new context/provider/store', () => {
    // Structural proof that BeeThemeScope adds no exported Provider, hook, or
    // store alongside the component itself.
    expect(Object.keys(BeeThemeScopeModule).sort()).toEqual(['BeeThemeScope']);
  });
});

describe('issue #68 — nesting, sibling scopes, and global theme switches', () => {
  it('renders distinct semantic values for nested scopes', () => {
    const screen = render(
      <BeeThemeScope appearance="dark" brand="violet">
        <ThemeProbe testID="outer" />
        <BeeThemeScope appearance="light" brand="bee">
          <ThemeProbe testID="inner" />
        </BeeThemeScope>
      </BeeThemeScope>,
    );
    expect(screen.getByTestId('outer').props.children).toBe('violet-dark');
    expect(screen.getByTestId('inner').props.children).toBe('light');
  });

  it('does not leak a scoped value into a sibling subtree outside the scope', () => {
    const screen = render(
      <>
        <BeeThemeScope appearance="dark" brand="violet">
          <ThemeProbe testID="scoped" />
        </BeeThemeScope>
        <ThemeProbe testID="sibling" />
      </>,
    );
    expect(screen.getByTestId('scoped').props.children).toBe('violet-dark');
    expect(screen.getByTestId('sibling').props.children).not.toBe('violet-dark');
    expect(screen.getByTestId('sibling').props.children).toBe('light');
  });

  it('keeps an explicit child scope stable across a global Uniwind.setTheme() call', () => {
    const screen = render(
      <>
        <BeeThemeScope appearance="dark" brand="violet">
          <ThemeProbe testID="scoped" />
        </BeeThemeScope>
        <ThemeProbe testID="global" />
      </>,
    );
    expect(screen.getByTestId('scoped').props.children).toBe('violet-dark');
    expect(screen.getByTestId('global').props.children).toBe('light');

    act(() => Uniwind.setTheme('dark'));

    // The global switch reaches the unscoped consumer...
    expect(screen.getByTestId('global').props.children).toBe('dark');
    // ...but never overrides the explicit child scope.
    expect(screen.getByTestId('scoped').props.children).toBe('violet-dark');
  });
});

function Counter({ testID }: { testID: string }) {
  const [count, setCount] = React.useState(0);
  return (
    <Pressable onPress={() => setCount((value) => value + 1)} testID={testID}>
      <Text testID={`${testID}-value`}>{count}</Text>
    </Pressable>
  );
}

describe('issue #68 — component state preservation across a scope change', () => {
  it('preserves local component state when only the scope theme prop changes', () => {
    const screen = render(
      <BeeThemeScope appearance="light" brand="bee">
        <Counter testID="counter" />
      </BeeThemeScope>,
    );

    fireEvent.press(screen.getByTestId('counter'));
    fireEvent.press(screen.getByTestId('counter'));
    expect(screen.getByTestId('counter-value').props.children).toBe(2);

    screen.rerender(
      <BeeThemeScope appearance="dark" brand="violet">
        <Counter testID="counter" />
      </BeeThemeScope>,
    );

    // The scope's resolved theme changed...
    expect(screen.getByTestId('counter-value').props.children).toBe(2);
    fireEvent.press(screen.getByTestId('counter'));
    expect(screen.getByTestId('counter-value').props.children).toBe(3);
  });
});

// jest is a JS-only runtime where teleport's native PortalHostView is
// unregistered, so by default the overlay runtime selects the legacy store
// host, which re-parents overlay content outside its declaration site and does
// not preserve React context (see overlay-host-mode.ts and
// issue-35-overlay-context.test.tsx). BeeThemeScope adds no propagation path of
// its own, so it inherits exactly that behavior — proven on both sides below by
// toggling the same capability switch used by overlay-transport.test.tsx.
describe('issue #68 — BeeThemeScope inside overlays: native-teleport transport preserves the scope', () => {
  beforeEach(() => setTeleportAvailable(true));

  it('resolves the scoped theme inside PopoverContent', async () => {
    const screen = renderOverlay(
      <BeeThemeScope appearance="dark" brand="violet">
        <Popover defaultOpen>
          <PopoverTrigger testID="trigger">Open</PopoverTrigger>
          <PopoverContent avoidSafeArea={false} testID="content">
            <ThemeProbe testID="probe" />
          </PopoverContent>
        </Popover>
      </BeeThemeScope>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe', { includeHiddenElements: true }).props.children).toBe(
        'violet-dark',
      );
    });
  });

  it('resolves the scoped theme inside a DropdownMenu', async () => {
    const screen = renderOverlay(
      <BeeThemeScope appearance="dark" brand="violet">
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger testID="menu-trigger">Menu</DropdownMenuTrigger>
          <DropdownMenuContent testID="menu-content">
            <DropdownMenuLabel>Menu</DropdownMenuLabel>
            <ThemeProbe testID="probe" />
          </DropdownMenuContent>
        </DropdownMenu>
      </BeeThemeScope>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe', { includeHiddenElements: true }).props.children).toBe(
        'violet-dark',
      );
    });
  });

  it('resolves the scoped theme inside DialogContent', async () => {
    const screen = renderOverlay(
      <BeeThemeScope appearance="dark" brand="violet">
        <Dialog defaultOpen>
          <DialogTrigger testID="dialog-trigger">Open dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle testID="dialog-title">Scoped dialog</DialogTitle>
            <ThemeProbe testID="probe" />
          </DialogContent>
        </Dialog>
      </BeeThemeScope>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe', { includeHiddenElements: true }).props.children).toBe(
        'violet-dark',
      );
    });
  });
});

describe('issue #68 — BeeThemeScope inside overlays: legacy transport does not cross the portal', () => {
  it('documents that PopoverContent falls back to the theme active at the application root', async () => {
    const screen = renderOverlay(
      <BeeThemeScope appearance="dark" brand="violet">
        <Popover defaultOpen>
          <PopoverTrigger testID="trigger">Open</PopoverTrigger>
          <PopoverContent avoidSafeArea={false} testID="content">
            <ThemeProbe testID="probe" />
          </PopoverContent>
        </Popover>
      </BeeThemeScope>,
      // Explicit deterministic transport seam (same one overlay-transport.test.tsx
      // uses) rather than relying on ambient New-Architecture/host-view detection,
      // which is not guaranteed false by default in this test environment.
      createLegacyStoreTransport(),
    );

    await waitFor(() => {
      // The scope set up around the Popover's declaration site is not visible to
      // its portaled content on the legacy transport — a documented, pre-#68
      // constraint of the shared overlay transport, not a BeeThemeScope bug.
      expect(screen.getByTestId('probe', { includeHiddenElements: true }).props.children).toBe(
        'light',
      );
    });
  });
});
