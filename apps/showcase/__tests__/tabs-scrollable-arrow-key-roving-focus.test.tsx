import { Tabs, TabsList, TabsTrigger } from '@beemvp/beeui-ui';
import { act, render } from '@testing-library/react-native';
import * as React from 'react';
import { Platform } from 'react-native';

// A `scrollable` `TabsList` (the #591 "open orders" strip) now supports Web arrow-key
// roving-tabindex navigation: ArrowLeft/ArrowRight move the roving "current" trigger with
// wrap-around, Home/End jump to the first/last enabled trigger, RTL flips which arrow key
// means "next", and the newly-focused trigger scrolls into view — all without changing
// `Tabs`'s own selection (manual-activation model; Enter/Space still selects, as before).
// A non-`scrollable` `TabsList` keeps its pre-existing behavior untouched (every trigger
// stays ordinarily Tab-reachable, no `tabIndex`/`onKeyDown` wiring at all).
//
// Real DOM `.focus()`/document.activeElement evidence belongs to Playwright
// (`apps/visual-regression/tests/tabs-scrollable-strip.spec.ts`), not this file — the
// `View`/`Pressable` refs React Test Renderer hands back here are composite-component
// instances, not real focusable host nodes, so "who is roving-current" is asserted the
// same way `tabs-closable-scrollable-strip.test.tsx` already does: `tabIndex` + the
// `ScrollView.scrollTo` call driven by the same state.

const originalPlatformOS = Platform.OS;

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

function setWebDocumentDir(dir: 'ltr' | 'rtl' | null) {
  if (dir === null) {
    delete (globalThis as { document?: unknown }).document;
    return;
  }
  (globalThis as { document?: unknown }).document = { documentElement: { dir } };
}

afterEach(() => {
  setPlatform(originalPlatformOS);
  setWebDocumentDir(null);
});

function OpenOrdersTabs({
  onValueChange,
  value,
}: {
  onValueChange: (value: string) => void;
  value: string;
}) {
  return (
    <Tabs onValueChange={onValueChange} value={value}>
      <TabsList scrollable testID="tabs-list">
        <TabsTrigger testID="tab-a" value="a">
          A
        </TabsTrigger>
        <TabsTrigger testID="tab-b" value="b">
          B
        </TabsTrigger>
        <TabsTrigger disabled testID="tab-c" value="c">
          C
        </TabsTrigger>
        <TabsTrigger testID="tab-d" value="d">
          D
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function pressKey(screen: ReturnType<typeof render>, key: string, testID = 'tabs-list') {
  act(() => {
    screen.getByTestId(testID).props.onKeyDown?.({ key, preventDefault: jest.fn() });
  });
}

function tabIndices(screen: ReturnType<typeof render>) {
  return {
    a: screen.getByTestId('tab-a').props.tabIndex,
    b: screen.getByTestId('tab-b').props.tabIndex,
    c: screen.getByTestId('tab-c').props.tabIndex,
    d: screen.getByTestId('tab-d').props.tabIndex,
  };
}

describe('TabsList scrollable arrow-key roving focus (Web)', () => {
  beforeEach(() => setPlatform('web'));

  it('gives the selected trigger tabIndex 0 and every other enabled trigger tabIndex -1', () => {
    const screen = render(<OpenOrdersTabs onValueChange={jest.fn()} value="b" />);
    expect(tabIndices(screen)).toEqual({ a: -1, b: 0, c: -1, d: -1 });
  });

  it('ArrowRight moves the roving-current trigger forward, skipping a disabled trigger, without changing selection', () => {
    const onValueChange = jest.fn();
    const screen = render(<OpenOrdersTabs onValueChange={onValueChange} value="a" />);

    pressKey(screen, 'ArrowRight');
    expect(tabIndices(screen)).toEqual({ a: -1, b: 0, c: -1, d: -1 });

    pressKey(screen, 'ArrowRight');
    // Skips the disabled "c" trigger entirely and lands on "d".
    expect(tabIndices(screen)).toEqual({ a: -1, b: -1, c: -1, d: 0 });

    // Moving focus never selects — only Enter/Space (native Pressable activation) does.
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('ArrowLeft wraps from the first enabled trigger to the last enabled trigger', () => {
    const screen = render(<OpenOrdersTabs onValueChange={jest.fn()} value="a" />);

    pressKey(screen, 'ArrowLeft');
    expect(tabIndices(screen)).toEqual({ a: -1, b: -1, c: -1, d: 0 });
  });

  it('Home/End jump to the first/last enabled trigger', () => {
    const screen = render(<OpenOrdersTabs onValueChange={jest.fn()} value="b" />);

    pressKey(screen, 'End');
    expect(tabIndices(screen)).toEqual({ a: -1, b: -1, c: -1, d: 0 });

    pressKey(screen, 'Home');
    expect(tabIndices(screen)).toEqual({ a: 0, b: -1, c: -1, d: -1 });
  });

  it('flips ArrowLeft/ArrowRight in RTL (ADR-004 direction precedence)', () => {
    setWebDocumentDir('rtl');
    const screen = render(<OpenOrdersTabs onValueChange={jest.fn()} value="a" />);

    // In RTL, ArrowLeft is "forward" (next) and ArrowRight is "backward" (previous).
    pressKey(screen, 'ArrowLeft');
    expect(tabIndices(screen)).toEqual({ a: -1, b: 0, c: -1, d: -1 });

    pressKey(screen, 'ArrowRight');
    expect(tabIndices(screen)).toEqual({ a: 0, b: -1, c: -1, d: -1 });
  });

  it('keeps close buttons out of the composite Tab order and closes the focused tab with Delete', () => {
    const onClose = jest.fn();
    const screen = render(
      <Tabs onValueChange={() => {}} value="a">
        <TabsList scrollable testID="tabs-list">
          <TabsTrigger closable closeAccessibilityLabel="Close A" onClose={onClose} testID="tab-a" value="a">A</TabsTrigger>
          <TabsTrigger closable closeAccessibilityLabel="Close B" onClose={onClose} testID="tab-b" value="b">B</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(screen.getByTestId('tab-a').props.tabIndex).toBe(0);
    expect(screen.getByLabelText('Close A').props.tabIndex).toBe(-1);
    expect(screen.getByLabelText('Close B').props.tabIndex).toBe(-1);

    pressKey(screen, 'ArrowRight');
    expect(screen.getByTestId('tab-b').props.tabIndex).toBe(0);

    const preventDefault = jest.fn();
    act(() => screen.getByTestId('tab-b').props.onKeyDown?.({ key: 'Delete', preventDefault }));
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith('b');
  });

  it('scrolls the newly-focused trigger into view', () => {
    const { ScrollView } = require('react-native');
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    const screen = render(<OpenOrdersTabs onValueChange={jest.fn()} value="a" />);

    act(() => {
      screen
        .getByTestId('tab-b')
        .props.onLayout?.({ nativeEvent: { layout: { height: 36, width: 48, x: 48, y: 0 } } });
    });
    scrollTo.mockClear();

    pressKey(screen, 'ArrowRight');

    expect(scrollTo).toHaveBeenCalledWith({ animated: false, x: 32 });
    scrollTo.mockRestore();
  });
});

describe('TabsList non-scrollable (unaffected by the roving-focus feature)', () => {
  it('leaves tabIndex untouched and does not wire onKeyDown, on Web or native', () => {
    setPlatform('web');
    const screen = render(
      <Tabs onValueChange={() => {}} value="a">
        <TabsList testID="tabs-list">
          <TabsTrigger testID="tab-a" value="a">
            A
          </TabsTrigger>
          <TabsTrigger testID="tab-b" value="b">
            B
          </TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(screen.getByTestId('tab-a').props.tabIndex).toBeUndefined();
    expect(screen.getByTestId('tab-b').props.tabIndex).toBeUndefined();
    expect(screen.getByTestId('tabs-list').props.onKeyDown).toBeUndefined();
  });
});
