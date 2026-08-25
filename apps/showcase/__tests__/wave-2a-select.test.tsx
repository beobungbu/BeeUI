import {
  Dialog,
  DialogContent,
  DialogTitle,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@beeui/ui';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';

// Exercise the context-preserving native transport deterministically in Jest.
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
  const frame = { x: 0, y: 0, width: 320, height: 240 };

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

const HOST_RECT = { x: 0, y: 0, width: 320, height: 240 };
const DEFAULT_ANCHOR = { x: 80, y: 40, width: 120, height: 44 };
const originalFabric = (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager;

type Rect = typeof DEFAULT_ANCHOR;

type RenderResult = ReturnType<typeof render> & {
  focusMocks: Record<string, jest.Mock>;
};

function setTeleportAvailable(available: boolean) {
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = available ? {} : undefined;
  jest.spyOn(UIManager, 'hasViewManagerConfig').mockReturnValue(available);
}

function renderSelect(
  children: React.ReactNode,
  anchorRects: Record<string, Rect> = { trigger: DEFAULT_ANCHOR },
): RenderResult {
  const focusMocks: Record<string, jest.Mock> = {};
  const screen = render(
    <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{children}</OverlayRuntimeProvider>,
    {
      createNodeMock: (element) => {
        const testID = element.props?.testID as string | undefined;
        if (!testID) return null;
        const focus = (focusMocks[testID] ??= jest.fn());
        const rect = anchorRects[testID];
        if (rect) {
          return {
            focus,
            measureInWindow: (
              callback: (x: number, y: number, width: number, height: number) => void,
            ) => callback(rect.x, rect.y, rect.width, rect.height),
          };
        }
        return { focus };
      },
    },
  );
  return Object.assign(screen, { focusMocks });
}

function pressContentKey(screen: RenderResult, key: string, testID = 'content') {
  act(() => {
    screen.getByTestId(testID, { includeHiddenElements: true }).props.onKeyDown?.({
      key,
      preventDefault: jest.fn(),
    });
  });
}

function BasicSelect({
  defaultOpen = true,
  defaultValue,
}: {
  defaultOpen?: boolean;
  defaultValue?: string;
}) {
  return (
    <Select defaultOpen={defaultOpen} defaultValue={defaultValue}>
      <SelectTrigger testID="trigger">
        <SelectValue placeholder="Choose fruit" testID="value" />
      </SelectTrigger>
      <SelectContent outsidePressTestID="outside" testID="content">
        <SelectItem testID="apple" value="apple">
          Apple
        </SelectItem>
        <SelectItem testID="banana" value="banana">
          Banana
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

describe('Wave 2A Select', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    setTeleportAvailable(true);
  });

  afterEach(() => {
    (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager = originalFabric;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
    jest.restoreAllMocks();
  });

  it('selects an uncontrolled option, updates the displayed value, and closes', async () => {
    const screen = renderSelect(<BasicSelect />);

    await waitFor(() => expect(screen.getByTestId('apple').props.accessibilityState.disabled).toBe(false));
    fireEvent.press(screen.getByTestId('banana'));

    await waitFor(() => expect(screen.getByTestId('value').props.children).toBe('Banana'));
    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(false);
    expect(screen.getByTestId('banana', { includeHiddenElements: true }).props.accessibilityState.selected).toBe(true);
  });

  it('requests controlled selection without inventing a local controlled value', async () => {
    const onValueChange = jest.fn();
    const onOpenChange = jest.fn();
    const screen = renderSelect(
      <Select open value="apple" onOpenChange={onOpenChange} onValueChange={onValueChange}>
        <SelectTrigger testID="trigger"><SelectValue testID="value" /></SelectTrigger>
        <SelectContent testID="content">
          <SelectItem testID="apple" value="apple">Apple</SelectItem>
          <SelectItem testID="banana" value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>,
    );

    await waitFor(() => expect(screen.getByTestId('value').props.children).toBe('Apple'));
    fireEvent.press(screen.getByTestId('banana'));

    expect(onValueChange).toHaveBeenCalledWith('banana');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('value').props.children).toBe('Apple');
    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(true);
  });

  it('renders a placeholder when there is no matching selection', async () => {
    const screen = renderSelect(<BasicSelect defaultOpen={false} />);
    await waitFor(() => expect(screen.getByTestId('value').props.children).toBe('Choose fruit'));
  });

  it('keeps a disabled Select inert and conveys disabled state', async () => {
    const onOpenChange = jest.fn();
    const screen = renderSelect(
      <Select disabled onOpenChange={onOpenChange}>
        <SelectTrigger testID="trigger"><SelectValue /></SelectTrigger>
        <SelectContent testID="content">
          <SelectItem testID="apple" value="apple">Apple</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByTestId('trigger').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('trigger'));
    expect(onOpenChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('apple', { includeHiddenElements: true }).props.accessibilityState.disabled).toBe(true));
  });

  it('skips a disabled item and leaves value/open state unchanged', async () => {
    const onValueChange = jest.fn();
    const screen = renderSelect(
      <Select defaultOpen onValueChange={onValueChange}>
        <SelectTrigger testID="trigger"><SelectValue testID="value" /></SelectTrigger>
        <SelectContent testID="content">
          <SelectItem disabled testID="apple" value="apple">Apple</SelectItem>
          <SelectItem testID="banana" value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>,
    );

    fireEvent.press(screen.getByTestId('apple'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(true);
  });

  it('exposes persistent selected option state', async () => {
    const screen = renderSelect(<BasicSelect defaultValue="apple" />);
    await waitFor(() => expect(screen.getByTestId('apple').props.accessibilityState.selected).toBe(true));
    expect(screen.getByTestId('banana').props.accessibilityState.selected).toBe(false);
  });

  it('fails duplicate values safe by disabling every duplicate', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onValueChange = jest.fn();
    const screen = renderSelect(
      <Select defaultOpen onValueChange={onValueChange}>
        <SelectTrigger testID="trigger"><SelectValue /></SelectTrigger>
        <SelectContent testID="content">
          <SelectItem testID="duplicate-a" value="same">A</SelectItem>
          <SelectItem testID="duplicate-b" value="same">B</SelectItem>
        </SelectContent>
      </Select>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('duplicate-a').props.accessibilityState.disabled).toBe(true);
      expect(screen.getByTestId('duplicate-b').props.accessibilityState.disabled).toBe(true);
    });
    fireEvent.press(screen.getByTestId('duplicate-a'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('preserves an uncontrolled value when its option is dynamically removed and shows placeholder', async () => {
    const onValueChange = jest.fn();
    function Fixture() {
      const [showApple, setShowApple] = React.useState(true);
      return (
        <>
          <Pressable testID="remove" onPress={() => setShowApple(false)} />
          <Select defaultValue="apple" onValueChange={onValueChange}>
            <SelectTrigger testID="trigger"><SelectValue placeholder="Missing" testID="value" /></SelectTrigger>
            <SelectContent testID="content">
              {showApple ? <SelectItem testID="apple" value="apple">Apple</SelectItem> : null}
              <SelectItem testID="banana" value="banana">Banana</SelectItem>
            </SelectContent>
          </Select>
        </>
      );
    }
    const screen = renderSelect(<Fixture />);

    await waitFor(() => expect(screen.getByTestId('value').props.children).toBe('Apple'));
    fireEvent.press(screen.getByTestId('remove'));
    await waitFor(() => expect(screen.getByTestId('value').props.children).toBe('Missing'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('opens and closes from the trigger without changing value', async () => {
    const screen = renderSelect(<BasicSelect defaultOpen={false} defaultValue="apple" />);
    await waitFor(() => expect(screen.getByTestId('value').props.children).toBe('Apple'));
    fireEvent.press(screen.getByTestId('trigger'));
    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(true);
    fireEvent.press(screen.getByTestId('trigger'));
    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(false);
    expect(screen.getByTestId('value').props.children).toBe('Apple');
  });

  it('dismisses on outside press without changing selection', async () => {
    const screen = renderSelect(<BasicSelect defaultValue="apple" />);
    await waitFor(() => expect(screen.getByTestId('outside')).toBeTruthy());
    fireEvent.press(screen.getByTestId('outside'));
    expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(false);
    expect(screen.getByTestId('apple', { includeHiddenElements: true }).props.accessibilityState.selected).toBe(true);
  });

  it('dismisses topmost Select through accessibility escape', async () => {
    const screen = renderSelect(<BasicSelect />);
    fireEvent(screen.getByTestId('content', { includeHiddenElements: true }), 'accessibilityEscape');
    await waitFor(() => expect(screen.getByTestId('trigger').props.accessibilityState.expanded).toBe(false));
  });

  it('navigates with Arrow keys and skips disabled options on web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const screen = renderSelect(
      <Select defaultOpen>
        <SelectTrigger testID="trigger"><SelectValue /></SelectTrigger>
        <SelectContent testID="content">
          <SelectItem testID="first" value="first">First</SelectItem>
          <SelectItem disabled testID="disabled" value="disabled">Disabled</SelectItem>
          <SelectItem testID="third" value="third">Third</SelectItem>
        </SelectContent>
      </Select>,
    );

    await waitFor(() => expect(screen.getByTestId('first').props.tabIndex).toBe(0));
    pressContentKey(screen, 'ArrowDown');
    await waitFor(() => expect(screen.getByTestId('third').props.tabIndex).toBe(0));
    pressContentKey(screen, 'ArrowUp');
    await waitFor(() => expect(screen.getByTestId('first').props.tabIndex).toBe(0));
  });

  it('supports Home, End, Enter, and Space selection on web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const onValueChange = jest.fn();
    const screen = renderSelect(
      <Select defaultOpen onValueChange={onValueChange}>
        <SelectTrigger testID="trigger"><SelectValue /></SelectTrigger>
        <SelectContent testID="content">
          <SelectItem testID="first" value="first">First</SelectItem>
          <SelectItem testID="last" value="last">Last</SelectItem>
        </SelectContent>
      </Select>,
    );

    await waitFor(() => expect(screen.getByTestId('first').props.tabIndex).toBe(0));
    pressContentKey(screen, 'End');
    await waitFor(() => expect(screen.getByTestId('last').props.tabIndex).toBe(0));
    pressContentKey(screen, 'Enter');
    expect(onValueChange).toHaveBeenCalledWith('last');
  });

  it('supports practical prefix typeahead on web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const screen = renderSelect(
      <Select defaultOpen>
        <SelectTrigger testID="trigger"><SelectValue /></SelectTrigger>
        <SelectContent testID="content">
          <SelectItem testID="apple" value="apple">Apple</SelectItem>
          <SelectItem testID="banana" value="banana">Banana</SelectItem>
          <SelectItem testID="blueberry" value="blueberry">Blueberry</SelectItem>
        </SelectContent>
      </Select>,
    );

    await waitFor(() => expect(screen.getByTestId('apple').props.tabIndex).toBe(0));
    pressContentKey(screen, 'b');
    await waitFor(() => expect(screen.getByTestId('banana').props.tabIndex).toBe(0));
    pressContentKey(screen, 'l');
    await waitFor(() => expect(screen.getByTestId('blueberry').props.tabIndex).toBe(0));
  });

  it('restores web focus to the trigger after selection', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const screen = renderSelect(<BasicSelect />);
    await waitFor(() => expect(screen.focusMocks.trigger).toBeDefined());
    fireEvent.press(screen.getByTestId('banana'));
    expect(screen.focusMocks.trigger).toHaveBeenCalled();
  });

  it('keeps a 101-option list selectable without virtualization-specific behavior', async () => {
    const onValueChange = jest.fn();
    const options = Array.from({ length: 101 }, (_, index) => `option-${index}`);
    const screen = renderSelect(
      <Select defaultOpen onValueChange={onValueChange}>
        <SelectTrigger testID="trigger"><SelectValue /></SelectTrigger>
        <SelectContent maxHeight={180} testID="content">
          {options.map((option) => (
            <SelectItem key={option} testID={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>,
    );

    fireEvent.press(screen.getByTestId('option-100'));
    expect(onValueChange).toHaveBeenCalledWith('option-100');
  });

  it('preserves consumer context through root Select portal content', async () => {
    const ConsumerContext = React.createContext('default');
    function Probe() {
      return <Text testID="context-value">{React.useContext(ConsumerContext)}</Text>;
    }
    const screen = renderSelect(
      <ConsumerContext.Provider value="preserved">
        <Select defaultOpen>
          <SelectTrigger testID="trigger"><SelectValue /></SelectTrigger>
          <SelectContent testID="content">
            <SelectItem textValue="Context" value="context"><Probe /></SelectItem>
          </SelectContent>
        </Select>
      </ConsumerContext.Provider>,
    );

    await waitFor(() => expect(screen.getByTestId('context-value').props.children).toBe('preserved'));
  });

  it('preserves consumer context inside a Dialog-local Select host', async () => {
    const ConsumerContext = React.createContext('default');
    function Probe() {
      return <Text testID="dialog-context-value">{React.useContext(ConsumerContext)}</Text>;
    }
    const screen = renderSelect(
      <ConsumerContext.Provider value="preserved">
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
            <Select defaultOpen>
              <SelectTrigger testID="dialog-trigger"><SelectValue /></SelectTrigger>
              <SelectContent testID="dialog-content">
                <SelectItem textValue="Context" value="context"><Probe /></SelectItem>
              </SelectContent>
            </Select>
          </DialogContent>
        </Dialog>
      </ConsumerContext.Provider>,
      { 'dialog-trigger': { x: 90, y: 90, width: 120, height: 44 } },
    );

    await waitFor(() => expect(screen.getByTestId('dialog-context-value').props.children).toBe('preserved'));
  });

  it('keeps selection stable across geometry rerenders', async () => {
    function Fixture({ hostX }: { hostX: number }) {
      return (
        <OverlayRuntimeProvider hostRectOverride={{ ...HOST_RECT, x: hostX }}>
          <Select defaultOpen defaultValue="apple">
            <SelectTrigger testID="trigger"><SelectValue testID="value" /></SelectTrigger>
            <SelectContent testID="content">
              <SelectItem testID="apple" value="apple">Apple</SelectItem>
            </SelectContent>
          </Select>
        </OverlayRuntimeProvider>
      );
    }
    const screen = render(<Fixture hostX={0} />, {
      createNodeMock: (element) =>
        element.props?.testID === 'trigger'
          ? {
              focus: jest.fn(),
              measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
                callback(80, 40, 120, 44),
            }
          : null,
    });
    await waitFor(() => expect(screen.getByTestId('value').props.children).toBe('Apple'));
    screen.rerender(<Fixture hostX={12} />);
    await waitFor(() => expect(screen.getByTestId('value').props.children).toBe('Apple'));
  });

  it('keeps a controlled old value visible while a parent delays its update', async () => {
    const onValueChange = jest.fn();
    const onOpenChange = jest.fn();
    const screen = renderSelect(
      <Select open value="apple" onOpenChange={onOpenChange} onValueChange={onValueChange}>
        <SelectTrigger testID="trigger"><SelectValue testID="value" /></SelectTrigger>
        <SelectContent testID="content">
          <SelectItem testID="apple" value="apple">Apple</SelectItem>
          <SelectItem testID="banana" value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>,
    );

    await waitFor(() => expect(screen.getByTestId('value').props.children).toBe('Apple'));
    fireEvent.press(screen.getByTestId('banana'));
    expect(onValueChange).toHaveBeenCalledWith('banana');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('value').props.children).toBe('Apple');
  });

  it('cleans overlay registrations on unmount without emitting selection changes', () => {
    const onValueChange = jest.fn();
    const screen = renderSelect(
      <Select defaultOpen onValueChange={onValueChange}>
        <SelectTrigger testID="trigger"><SelectValue /></SelectTrigger>
        <SelectContent testID="content">
          <SelectItem value="apple">Apple</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(() => screen.unmount()).not.toThrow();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('provides group and label semantics without changing option selection', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const screen = renderSelect(
      <Select defaultOpen defaultValue="apple">
        <SelectTrigger testID="trigger"><SelectValue testID="value" /></SelectTrigger>
        <SelectContent testID="content">
          <SelectGroup testID="group">
            <SelectLabel testID="label">Fruit</SelectLabel>
            <SelectItem testID="apple" value="apple">Apple</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );

    await waitFor(() => expect(screen.getByTestId('value').props.children).toBe('Apple'));
    expect(screen.getByTestId('group').props.role).toBe('group');
    expect(screen.getByTestId('group').props.accessibilityLabelledBy).toBe(screen.getByTestId('label').props.nativeID);
    expect(screen.getByTestId('apple').props.role).toBe('option');
  });

  it('keeps closed content mounted but hidden so selected metadata remains deterministic', async () => {
    const screen = renderSelect(<BasicSelect defaultOpen={false} defaultValue="apple" />);
    await waitFor(() => expect(screen.getByTestId('value').props.children).toBe('Apple'));
    const content = screen.getByTestId('content', { includeHiddenElements: true });
    expect(StyleSheet.flatten(content.props.style)).toMatchObject({ display: 'none' });
    expect(content.props.pointerEvents).toBe('none');
    expect(content.props['aria-hidden']).toBe(true);
  });
});
