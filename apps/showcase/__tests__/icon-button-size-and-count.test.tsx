import { IconButton, Text } from '@beemvp/beeui-ui';
import { render } from '@testing-library/react-native';
import * as React from 'react';

// `IconButtonProps` had no `size` prop while the rest of the Button family
// (`Button`, `DropdownMenuTrigger`, `PopoverTrigger`) exposes one, forcing
// consumers onto a non-portable `className="h-8 w-8"` override for dense
// surfaces (cart steppers, table row actions). It also had no way to overlay
// a small count/unread badge, so a notification bell needed a hand-built
// IconButton + absolutely positioned Badge.

const SIZE_TOKENS = ['control-compact', 'control-default', 'control-large', 'control-icon'] as const;

// Exactly one height and one width token may reach the element: a second one
// is not removed by tailwind-merge (it does not know the token names), and the
// stylesheet order, not the `size` prop, then decides the rendered size.
function sizeTokensOn(className: string) {
  const tokens = className.split(/\s+/);
  return {
    height: SIZE_TOKENS.filter((token) => tokens.includes(`h-${token}`)),
    width: SIZE_TOKENS.filter((token) => tokens.includes(`w-${token}`)),
  };
}

describe('IconButton size', () => {
  it.each([
    [undefined, 'control-icon'],
    ['sm', 'control-compact'],
    ['md', 'control-default'],
    ['lg', 'control-large'],
  ] as const)('size=%s renders only the %s square', (size, token) => {
    const screen = render(
      <IconButton accessibilityLabel="Increase quantity" size={size} testID="icon-button">
        <Text>+</Text>
      </IconButton>,
    );

    const className = screen.getByTestId('icon-button').props.className as string;
    expect(sizeTokensOn(className)).toEqual({ height: [token], width: [token] });
  });

  it('keeps the small visual box on native and extends only its tappable region to the 44dp floor', () => {
    const screen = render(
      <IconButton accessibilityLabel="Increase quantity" size="sm" testID="icon-button">
        <Text>+</Text>
      </IconButton>,
    );

    const button = screen.getByTestId('icon-button');
    // A min-h/min-w touch-target guard would grow the visual box back to 44.
    expect(button.props.className).not.toContain('touch-target');
    // 36 + 4 + 4 = 44 in both dimensions.
    expect(button.props.hitSlop).toEqual({ bottom: 4, left: 4, right: 4, top: 4 });
  });

  it('adds no hit slop to sizes that already meet the touch-target floor', () => {
    for (const size of [undefined, 'md', 'lg'] as const) {
      const screen = render(
        <IconButton accessibilityLabel="Open" size={size} testID="icon-button">
          <Text>+</Text>
        </IconButton>,
      );
      expect(screen.getByTestId('icon-button').props.hitSlop).toBeUndefined();
      screen.unmount();
    }
  });

  it("lets the caller's own hitSlop win", () => {
    const screen = render(
      <IconButton accessibilityLabel="Increase quantity" hitSlop={10} size="sm" testID="icon-button">
        <Text>+</Text>
      </IconButton>,
    );
    expect(screen.getByTestId('icon-button').props.hitSlop).toBe(10);
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
    render(
      <IconButton accessibilityLabel="Notifications" count={3} style={style} testID="icon-button">
        <Text>Bell</Text>
      </IconButton>,
    );

    // RNTL exposes the host View after Pressable has resolved the style callback, so the host
    // receives the returned style object rather than the original function reference. Prove the
    // caller callback survived by asserting Pressable actually invoked it with its state.
    expect(style).toHaveBeenCalledWith(expect.objectContaining({ pressed: false }));
  });
});
