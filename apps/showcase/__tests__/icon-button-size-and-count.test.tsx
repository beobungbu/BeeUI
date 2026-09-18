import { IconButton, Text } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';

// `IconButtonProps` had no `size` prop while the rest of the Button family
// (`Button`, `DropdownMenuTrigger`, `PopoverTrigger`) exposes one, forcing
// consumers onto a non-portable `className="h-8 w-8"` override for dense
// surfaces (cart steppers, table row actions). It also had no way to overlay
// a small count/unread badge, so a notification bell needed a hand-built
// IconButton + absolutely positioned Badge.

describe('IconButton size', () => {
  it('defaults to the icon square size', () => {
    const screen = render(
      <IconButton accessibilityLabel="Delete" testID="icon-button">
        <Text>X</Text>
      </IconButton>,
    );

    const className = screen.getByTestId('icon-button').props.className as string;
    expect(className).toContain('h-control-icon');
    expect(className).toContain('w-control-icon');
  });

  it('renders a smaller square control for size="sm" without dropping the touch-target guard', () => {
    const screen = render(
      <IconButton accessibilityLabel="Increase quantity" size="sm" testID="icon-button">
        <Text>+</Text>
      </IconButton>,
    );

    const className = screen.getByTestId('icon-button').props.className as string;
    expect(className).toContain('h-control-compact');
    expect(className).toContain('w-control-compact');
    expect(className).toContain('ios:min-h-touch-target');
    expect(className).toContain('android:min-h-touch-target');
  });

  it('renders a larger square control for size="lg"', () => {
    const screen = render(
      <IconButton accessibilityLabel="Open" size="lg" testID="icon-button">
        <Text>+</Text>
      </IconButton>,
    );

    const className = screen.getByTestId('icon-button').props.className as string;
    expect(className).toContain('h-control-large');
    expect(className).toContain('w-control-large');
  });
});

describe('IconButton count', () => {
  it('renders no badge when count is omitted', () => {
    const screen = render(
      <IconButton accessibilityLabel="Notifications" testID="icon-button">
        <Text>Bell</Text>
      </IconButton>,
    );

    expect(screen.getByTestId('icon-button').props.accessibilityLabel).toBe('Notifications');
    expect(screen.queryByText('3')).toBeNull();
  });

  it('renders a numeric count badge and appends it to the accessible name', () => {
    const screen = render(
      <IconButton accessibilityLabel="Notifications" count={3} testID="icon-button">
        <Text>Bell</Text>
      </IconButton>,
    );

    expect(screen.getByTestId('icon-button').props.accessibilityLabel).toBe('Notifications, 3');
    // The badge overlay is `aria-hidden` (its text is already folded into the
    // button's own `accessibilityLabel` above, so it must not also be a
    // separately-announced node) — visible to a sighted user, but only
    // reachable here via `includeHiddenElements`.
    expect(screen.getByText('3', { includeHiddenElements: true })).toBeTruthy();
  });

  it('renders a custom node count without altering the accessible name', () => {
    const screen = render(
      <IconButton
        accessibilityLabel="Status"
        count={<Text accessibilityLabel="online">●</Text>}
        testID="icon-button"
      >
        <Text>Bell</Text>
      </IconButton>,
    );

    expect(screen.getByTestId('icon-button').props.accessibilityLabel).toBe('Status');
    expect(screen.getByLabelText('online', { includeHiddenElements: true })).toBeTruthy();
  });
});
