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

  it('renders a smaller square control for size="sm" guarding a 44dp tappable region in both dimensions', () => {
    const screen = render(
      <IconButton accessibilityLabel="Increase quantity" size="sm" testID="icon-button">
        <Text>+</Text>
      </IconButton>,
    );

    const className = screen.getByTestId('icon-button').props.className as string;
    expect(className).toContain('h-control-compact');
    expect(className).toContain('w-control-compact');
    expect(className).toContain('ios:min-h-touch-target');
    expect(className).toContain('ios:min-w-touch-target');
    expect(className).toContain('android:min-h-touch-target');
    expect(className).toContain('android:min-w-touch-target');
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

  it('renders a custom node count without altering the accessible name, and leaves it reachable by its own accessible text', () => {
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
    // Unlike the numeric/string case, a custom node's text is never folded
    // into the button's own accessibilityLabel, so it must stay out of the
    // aria-hidden subtree to be reachable at all — no `includeHiddenElements`
    // escape hatch needed here.
    expect(screen.getByLabelText('online')).toBeTruthy();
  });
});

describe('IconButton layout root', () => {
  it('renders the Button as the single, outermost rendered node when count is omitted, so layout className/style land on it directly', () => {
    const screen = render(
      <IconButton
        accessibilityLabel="Delete"
        className="flex-1 self-center"
        style={{ marginTop: 8 }}
        testID="icon-button"
      >
        <Text>X</Text>
      </IconButton>,
    );

    // The rendered tree's own root node (not merely a queryable descendant)
    // is the Button itself — no extra wrapping host View sits above it, so a
    // caller's layout className/style is exactly what the Button's parent
    // flex container sees.
    const tree = screen.toJSON() as { type: string; props: Record<string, unknown> };
    expect(tree.type).toBe('View');
    expect(tree.props.testID).toBe('icon-button');
    expect(tree.props.className).toContain('flex-1');
    expect(tree.props.className).toContain('self-center');
    expect(tree.props.style).toEqual({ marginTop: 8 });
  });

  it('keeps the Button as the outermost layout root when count is present', () => {
    const screen = render(<IconButton accessibilityLabel="Notifications" className="flex-1 self-center" count={3} style={{ marginTop: 8 }} testID="icon-button"><Text>Bell</Text></IconButton>);
    const tree = screen.toJSON() as { type: string; props: Record<string, unknown> };
    expect(tree.props.testID).toBe('icon-button');
    expect(tree.props.className).toContain('relative');
    expect(tree.props.style).toEqual({ marginTop: 8 });
  });

  it('preserves Pressable style callbacks when count is present', () => {
    const style = jest.fn(({ pressed }: { pressed: boolean }) => ({ opacity: pressed ? 0.5 : 1 }));
    const screen = render(<IconButton accessibilityLabel="Notifications" count={3} style={style} testID="icon-button"><Text>Bell</Text></IconButton>);
    expect(screen.getByTestId('icon-button').props.style).toBe(style);
  });
});
