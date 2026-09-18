import { ListItem } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';
import { Text, View } from 'react-native';

// Two `ListItem` gaps found in the BeePOS restyle:
//   1. No `active`/`selected` visual-state prop — sidebar navigation (the
//      most common list use) fell back to conditional `className`.
//   2. A two-value row built from a `title` *node* (not a plain string) lost
//      its accessible name entirely — `role="button"` with nothing to act on.

describe('ListItem active', () => {
  it('paints a tokenized background and marks aria-current on Web', () => {
    const screen = render(<ListItem active testID="item" title="Dashboard" />);

    const item = screen.getByTestId('item');
    expect(item.props.className).toContain('bg-primary/10');
    expect(item.props['aria-current']).toBe('true');
  });

  it('sets accessibilityState.selected for native, even on a non-interactive row', () => {
    const screen = render(<ListItem active testID="item" title="Dashboard" />);

    expect(screen.getByTestId('item').props.accessibilityState.selected).toBe(true);
  });

  it('defaults to inactive (no background token, no aria-current)', () => {
    const screen = render(<ListItem testID="item" title="Settings" />);

    const item = screen.getByTestId('item');
    expect(item.props.className).not.toContain('bg-primary/10');
    expect(item.props['aria-current']).toBeUndefined();
  });
});

describe('ListItem accessible name from a node title', () => {
  it('synthesizes the accessible name from rendered text children when title is a node', () => {
    const screen = render(
      <ListItem
        onPress={() => {}}
        testID="item"
        title={
          <View>
            <Text>Wi-Fi</Text>
            <Text>On</Text>
          </View>
        }
      />,
    );

    expect(screen.getByTestId('item').props.accessibilityLabel).toBe('Wi-Fi, On');
  });

  it('still lets an explicit accessibilityLabel win over the synthesized one', () => {
    const screen = render(
      <ListItem
        accessibilityLabel="Wi-Fi, currently on"
        onPress={() => {}}
        testID="item"
        title={
          <View>
            <Text>Wi-Fi</Text>
            <Text>On</Text>
          </View>
        }
      />,
    );

    expect(screen.getByTestId('item').props.accessibilityLabel).toBe('Wi-Fi, currently on');
  });

  it('keeps the plain-string title path unchanged', () => {
    const screen = render(<ListItem onPress={() => {}} testID="item" title="Settings" />);

    expect(screen.getByTestId('item').props.accessibilityLabel).toBe('Settings');
  });
});
