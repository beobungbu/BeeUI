import * as React from 'react';
import { Calendar } from '@beemvp/beeui-ui';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

// `selected` is one of React Native's compound `AccessibilityState` keys, so
// `Pressable` normalizes an `accessibilityState.selected` value before it reaches
// a host node and strips the raw `aria-selected` prop along the way (same
// normalization already documented for `aria-checked` in
// selection-control-aria.test.tsx). Asserting the literal prop the selected day
// cell hands to `Pressable` therefore needs raw `react-test-renderer`, not
// `@testing-library/react-native`'s host-only query helpers.
function isPressableInstance(node: ReactTestInstance): boolean {
  if (typeof node.type === 'string') return false;
  const type = node.type as { displayName?: string; name?: string };
  return (type.displayName ?? type.name) === 'Pressable';
}

function findPressableByTestId(renderer: ReactTestRenderer, testID: string): ReactTestInstance {
  const matches = renderer.root.findAll(
    (node) => isPressableInstance(node) && node.props.testID === testID,
  );
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one Pressable with testID "${testID}", found ${matches.length}`);
  }
  return matches[0];
}

describe('BeeUI Calendar selected day aria-selected', () => {
  it('exposes aria-selected="true" on the controlled selected day and "false" on other selectable days', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <Calendar
          locale="en-US"
          onValueChange={() => {}}
          testID="campaign-calendar"
          value={{ year: 2026, month: 1, day: 1 }}
        />,
      );
    });

    const selectedDay = findPressableByTestId(renderer, 'campaign-calendar-day-2026-01-01');
    const otherDay = findPressableByTestId(renderer, 'campaign-calendar-day-2026-01-02');

    expect(selectedDay.props['aria-selected']).toBe(true);
    expect(otherDay.props['aria-selected']).toBe(false);
  });
});
