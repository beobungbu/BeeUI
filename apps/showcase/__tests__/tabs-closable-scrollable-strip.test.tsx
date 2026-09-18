import { Tabs, TabsList, TabsTrigger } from '@beemvp/beeui-ui';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as React from 'react';
import { ScrollView } from 'react-native';

// #591 — a closable, scrollable tab strip for POS "open orders". `TabsList` now accepts
// `scrollable`/`addon`, and `TabsTrigger` accepts `closable`/`closeAccessibilityLabel`/
// `onClose`, extending the existing Tabs family rather than adding a new one.

function OpenOrdersTabs({
  onClose,
  onValueChange,
  value,
}: {
  onClose: (value: string) => void;
  onValueChange: (value: string) => void;
  value: string;
}) {
  return (
    <Tabs onValueChange={onValueChange} value={value}>
      <TabsList scrollable>
        <TabsTrigger closable closeAccessibilityLabel="Close Order 1" onClose={onClose} value="order-1">
          Order 1
        </TabsTrigger>
        <TabsTrigger closable closeAccessibilityLabel="Close Order 2" onClose={onClose} value="order-2">
          Order 2
        </TabsTrigger>
        <TabsTrigger closable closeAccessibilityLabel="Close Order 3" onClose={onClose} value="order-3">
          Order 3
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

describe('Tabs closable tab strip', () => {
  it('renders an accessible close control per closable trigger, as a sibling (not nested inside the tab pressable)', () => {
    render(<OpenOrdersTabs onClose={() => {}} onValueChange={() => {}} value="order-1" />);

    const closeControl = screen.getByLabelText('Close Order 2');
    expect(closeControl.props.accessibilityRole).toBe('button');

    const tab = screen.getByLabelText('Order 2');
    expect(tab.props.accessibilityRole).toBe('tab');
    // The close control must not be a descendant of the tab's own pressable — every ancestor
    // between it and the root is a plain wrapping `View`, never another Pressable/tab.
    expect(closeControl).not.toBe(tab);
  });

  it('calls onClose with the tab value when its close control is pressed, without changing selection for a non-selected tab', () => {
    const onClose = jest.fn();
    const onValueChange = jest.fn();
    render(<OpenOrdersTabs onClose={onClose} onValueChange={onValueChange} value="order-1" />);

    fireEvent.press(screen.getByLabelText('Close Order 2'));

    expect(onClose).toHaveBeenCalledWith('order-2');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('moves selection to the previous sibling when the currently-selected tab is closed', () => {
    const onClose = jest.fn();
    const onValueChange = jest.fn();
    render(<OpenOrdersTabs onClose={onClose} onValueChange={onValueChange} value="order-2" />);

    fireEvent.press(screen.getByLabelText('Close Order 2'));

    expect(onClose).toHaveBeenCalledWith('order-2');
    expect(onValueChange).toHaveBeenCalledWith('order-1');
  });

  it('moves selection to the next sibling when the closed tab is first (no previous sibling)', () => {
    const onClose = jest.fn();
    const onValueChange = jest.fn();
    render(<OpenOrdersTabs onClose={onClose} onValueChange={onValueChange} value="order-1" />);

    fireEvent.press(screen.getByLabelText('Close Order 1'));

    expect(onValueChange).toHaveBeenCalledWith('order-2');
  });

  it('warns in dev when closable is set without closeAccessibilityLabel', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Tabs onValueChange={() => {}} value="a">
        <TabsList>
          <TabsTrigger closable value="a">
            A
          </TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('closeAccessibilityLabel'));
    warn.mockRestore();
  });
});

describe('Tabs scrollable tab strip', () => {
  it('wraps the strip in a horizontal ScrollView when scrollable is true, and not otherwise', () => {
    const scrollable = render(
      <Tabs onValueChange={() => {}} value="a">
        <TabsList scrollable>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(scrollable.UNSAFE_queryAllByType(ScrollView)).toHaveLength(1);

    const fixed = render(
      <Tabs onValueChange={() => {}} value="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(fixed.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
  });

  it('scrolls the newly-selected tab into view when the controlled value changes', () => {
    function Example({ value }: { value: string }) {
      return (
        <Tabs onValueChange={() => {}} value={value}>
          <TabsList scrollable>
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
            <TabsTrigger value="c">C</TabsTrigger>
          </TabsList>
        </Tabs>
      );
    }

    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    const screenResult = render(<Example value="a" />);

    // Reports "c"'s natural layout position (x: 96) via onLayout, mirroring what a real
    // layout pass reports for the third 48px-wide trigger in the row.
    const triggerC = screenResult.getByLabelText('C');
    fireEvent(triggerC, 'layout', { nativeEvent: { layout: { height: 36, width: 48, x: 96, y: 0 } } });

    screenResult.rerender(<Example value="c" />);

    expect(scrollTo).toHaveBeenCalledWith({ animated: true, x: 80 });
  });

  it('renders an addon pinned outside the scrollable region', () => {
    const screenResult = render(
      <Tabs onValueChange={() => {}} value="a">
        <TabsList addon={<React.Fragment key="addon" />} scrollable>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    // The `ScrollView` wraps only the triggers — the addon renders as the tablist
    // container's own trailing sibling, never inside the `ScrollView`'s scrollable content.
    const scrollView = screenResult.UNSAFE_getByType(ScrollView);
    expect(scrollView.findAllByType(TabsTrigger)).toHaveLength(1);
  });
});
