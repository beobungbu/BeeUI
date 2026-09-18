import { render } from '@testing-library/react-native';
import * as React from 'react';
import { DropdownMenu, DropdownMenuTrigger } from '@beemvp/beeui-ui';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

// React Native's `Pressable` manages hover internally and does not forward
// `onHoverIn`/`onHoverOut` as literal props onto whatever host element it
// renders (same class of composite-vs-host boundary already documented in
// selection-control-aria.test.tsx for `aria-checked`), so asserting that the
// callback reaches `Pressable` at all needs raw `react-test-renderer`, not
// `@testing-library/react-native`'s host-only query helpers.
function isPressableInstance(node: ReactTestInstance): boolean {
  if (typeof node.type === 'string') return false;
  const type = node.type as { displayName?: string; name?: string };
  return (type.displayName ?? type.name) === 'Pressable';
}

function findPressable(renderer: ReactTestRenderer): ReactTestInstance {
  const matches = renderer.root.findAll(isPressableInstance);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one Pressable, found ${matches.length}`);
  }
  return matches[0];
}

// WAI-ARIA APG Menu Button Pattern: a button that opens `role="menu"` content must
// expose `aria-haspopup="menu"` so assistive tech announces it as a menu button.
describe('BeeUI DropdownMenuTrigger aria-haspopup', () => {
  it('exposes aria-haspopup="menu" before the menu opens', () => {
    const screen = render(
      <DropdownMenu defaultOpen={false}>
        <DropdownMenuTrigger testID="order-actions-trigger">Order actions</DropdownMenuTrigger>
      </DropdownMenu>,
    );

    expect(screen.getByTestId('order-actions-trigger').props['aria-haspopup']).toBe('menu');
  });

  it('keeps aria-haspopup="menu" while the menu is open', () => {
    const screen = render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger testID="order-actions-trigger">Order actions</DropdownMenuTrigger>
      </DropdownMenu>,
    );

    expect(screen.getByTestId('order-actions-trigger').props['aria-haspopup']).toBe('menu');
  });
});

// the trigger previously forwarded no visible-hover affordance and a
// caller had to wrap it in an extra View with its own onPointerEnter/Leave just to
// show it was interactive.
describe('BeeUI DropdownMenuTrigger hover affordance', () => {
  it('carries a web hover class regardless of the chosen variant', () => {
    const screen = render(
      <DropdownMenu defaultOpen={false}>
        <DropdownMenuTrigger testID="store-switcher-trigger" variant="ghost">
          Tạp hoá Cầu Giấy
        </DropdownMenuTrigger>
      </DropdownMenu>,
    );

    expect(screen.getByTestId('store-switcher-trigger').props.className).toContain('web:hover:opacity-80');
  });

  it('forwards a caller-supplied onHoverIn/onHoverOut instead of swallowing them', () => {
    const onHoverIn = jest.fn();
    const onHoverOut = jest.fn();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <DropdownMenu defaultOpen={false}>
          <DropdownMenuTrigger onHoverIn={onHoverIn} onHoverOut={onHoverOut}>
            Tạp hoá Cầu Giấy
          </DropdownMenuTrigger>
        </DropdownMenu>,
      );
    });

    const trigger = findPressable(renderer);
    trigger.props.onHoverIn?.();
    trigger.props.onHoverOut?.();

    expect(onHoverIn).toHaveBeenCalledTimes(1);
    expect(onHoverOut).toHaveBeenCalledTimes(1);
  });
});
