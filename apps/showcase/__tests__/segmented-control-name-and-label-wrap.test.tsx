import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import { Field, SegmentedControl, SegmentedControlItem } from '@beemvp/beeui-ui';

// The `radiogroup` had no accessible name at all, so a screen reader
// announced bare "radio group" with no context.
describe('BeeUI SegmentedControl radiogroup accessible name', () => {
  it('exposes an explicit accessibilityLabel on the radiogroup', () => {
    const screen = render(
      <SegmentedControl accessibilityLabel="Theme" onValueChange={() => {}} testID="theme-control" value="system">
        <SegmentedControlItem value="light">Light</SegmentedControlItem>
        <SegmentedControlItem value="system">System</SegmentedControlItem>
      </SegmentedControl>,
    );

    const control = screen.getByTestId('theme-control');
    expect(control.props.accessibilityRole).toBe('radiogroup');
    expect(control.props.accessibilityLabel).toBe('Theme');
  });

  it('falls back to the enclosing Field label when no own accessibilityLabel is given', () => {
    const screen = render(
      <Field label="Theme">
        <SegmentedControl onValueChange={() => {}} testID="theme-control" value="system">
          <SegmentedControlItem value="light">Light</SegmentedControlItem>
          <SegmentedControlItem value="system">System</SegmentedControlItem>
        </SegmentedControl>
      </Field>,
    );

    const control = screen.getByTestId('theme-control');
    expect(control.props.accessibilityLabel).toBe('Theme');
  });
});

// A segment label truncated mid-glyph at large accessibility text sizes
// instead of wrapping, because a React Native flex item's default flexShrink is 0.
describe('BeeUI SegmentedControlItem label wraps instead of clipping', () => {
  it('gives the label the full item width so it can wrap instead of clip', () => {
    const screen = render(
      <SegmentedControl onValueChange={() => {}} value="system">
        <SegmentedControlItem testID="system-item" value="system">
          Theo hệ thống
        </SegmentedControlItem>
      </SegmentedControl>,
    );

    const label = screen.getByText('Theo hệ thống');
    expect(label.props.className).toContain('w-full');
  });
});

// Splitting the row equally broke short labels mid-word in a narrow container
// ("thù / ng 24") while a neighbour had room to spare. Segments now start
// from their label's own width and never shrink below the widest word plus
// their own padding/border, so labels wrap only between words.
function layout(width: number, x = 0) {
  return { nativeEvent: { layout: { height: 36, width, x, y: 0 } } };
}

const exact = { normalizer: (text: string) => text };

function minWidthOf(element: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(element.props.style as never) as { minWidth?: number } | undefined)?.minWidth;
}

// Item chrome: px-3 (12 + 12) plus a 1px border on each side; the full-width
// label starts 13px into the item.
const CHROME = 26;
const LABEL_INSET = 13;

function layOutSegment(
  screen: ReturnType<typeof render>,
  { itemId, label, widestWord, width, x }: { itemId: string; label: string; widestWord: number; width: number; x: number },
) {
  fireEvent(screen.getByTestId(itemId), 'layout', layout(width, x));
  const visibleLabel = screen.getByText(label);
  fireEvent(visibleLabel, 'layout', layout(width - CHROME, LABEL_INSET));
  // The hidden copy lays the label out one word per line.
  const measurer = screen
    .getAllByText(label.split(' ').join('\n'), { ...exact, includeHiddenElements: true })
    .find((element) => element !== visibleLabel);
  if (!measurer) throw new Error(`no word measurement for ${label}`);
  fireEvent(measurer, 'layout', layout(widestWord));
}

function renderPackSizes() {
  return render(
    <SegmentedControl onValueChange={() => {}} testID="control" value="chai">
      <SegmentedControlItem testID="chai" value="chai">
        chai
      </SegmentedControlItem>
      <SegmentedControlItem testID="loc" value="loc">
        lốc 6
      </SegmentedControlItem>
      <SegmentedControlItem testID="thung" value="thung">
        thùng 24
      </SegmentedControlItem>
    </SegmentedControl>,
  );
}

describe('BeeUI SegmentedControl sizes segments from their labels', () => {
  it('starts each segment from its label width instead of an equal share of the row', () => {
    const screen = renderPackSizes();
    const className = screen.getByTestId('thung').props.className as string;
    expect(className.split(/\s+/)).not.toContain('flex-1');
    expect(className).toContain('basis-auto');
    expect(className).toContain('grow');
    expect(className).toContain('shrink');
  });

  it('keeps the word measurement out of the accessibility tree', () => {
    const screen = renderPackSizes();
    expect(screen.queryByText('thùng\n24', exact)).toBeNull();
    expect(screen.getByText('thùng\n24', { ...exact, includeHiddenElements: true })).toBeTruthy();
  });

  it('floors every segment at its widest word plus its own padding and border', () => {
    const screen = renderPackSizes();
    fireEvent(screen.getByTestId('control'), 'layout', layout(300));
    layOutSegment(screen, { itemId: 'chai', label: 'chai', widestWord: 27.4, width: 97, x: 4 });
    layOutSegment(screen, { itemId: 'loc', label: 'lốc 6', widestWord: 23.1, width: 97, x: 101 });
    layOutSegment(screen, { itemId: 'thung', label: 'thùng 24', widestWord: 41.3, width: 98, x: 198 });

    // ceil(widest word + chrome) + 1px against sub-pixel rounding.
    expect(minWidthOf(screen.getByTestId('chai'))).toBe(Math.ceil(27.4 + CHROME) + 1);
    expect(minWidthOf(screen.getByTestId('loc'))).toBe(Math.ceil(23.1 + CHROME) + 1);
    expect(minWidthOf(screen.getByTestId('thung'))).toBe(Math.ceil(41.3 + CHROME) + 1);
  });

  it('scales the floors down only when they cannot all fit inside the control', () => {
    const screen = renderPackSizes();
    // 150 wide with p-1: 142px for the items; the floors need 55 + 51 + 69 = 175.
    fireEvent(screen.getByTestId('control'), 'layout', layout(150));
    layOutSegment(screen, { itemId: 'chai', label: 'chai', widestWord: 27.4, width: 47, x: 4 });
    layOutSegment(screen, { itemId: 'loc', label: 'lốc 6', widestWord: 23.1, width: 47, x: 51 });
    layOutSegment(screen, { itemId: 'thung', label: 'thùng 24', widestWord: 41.3, width: 48, x: 98 });

    const scale = 142 / 175;
    expect(minWidthOf(screen.getByTestId('chai'))).toBeCloseTo(55 * scale, 3);
    expect(minWidthOf(screen.getByTestId('loc'))).toBeCloseTo(51 * scale, 3);
    expect(minWidthOf(screen.getByTestId('thung'))).toBeCloseTo(69 * scale, 3);
  });

  it("keeps the caller's own style on top of the floor", () => {
    const screen = render(
      <SegmentedControl onValueChange={() => {}} testID="control" value="chai">
        <SegmentedControlItem style={{ minWidth: 120, opacity: 0.5 }} testID="chai" value="chai">
          chai
        </SegmentedControlItem>
      </SegmentedControl>,
    );
    fireEvent(screen.getByTestId('control'), 'layout', layout(300));
    layOutSegment(screen, { itemId: 'chai', label: 'chai', widestWord: 27.4, width: 292, x: 4 });
    expect(StyleSheet.flatten(screen.getByTestId('chai').props.style)).toMatchObject({ minWidth: 120, opacity: 0.5 });
  });
});
