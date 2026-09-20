import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View } from 'react-native';
import { Button, type ButtonProps } from './button';
import { Text } from './text';

// `Button`'s own `size` variants (`sm`/`md`/`lg`) size a *rectangular* control
// with horizontal label padding (`px-3`/`px-4`/`px-5`) — reusing them as-is on
// an icon-only control would render a wide, off-center box around a small
// glyph. Reusing the same underlying control-height tokens as `Button`'s own
// `sm`/`md`/`lg` (`--spacing-control-compact/default/large`, already used for
// height there) as BOTH height and width — with `px-0`, matching `icon`'s own
// existing square treatment — gives a genuinely square control per size
// without introducing a new token. `sm` keeps the native touch-target guard
// (`Button`'s own `sm` has it too): its 36px visual box sizes below the
// accepted 44dp floor, so the *tappable* region still meets it even though
// the *visual* box is smaller — the same "small visual, accessible target"
// pattern `TableHead`'s sort trigger already uses.
const iconButtonSizeClassName: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-control-compact w-control-compact px-0 ios:min-h-touch-target ios:min-w-touch-target android:min-h-touch-target android:min-w-touch-target',
  md: 'h-control-default w-control-default px-0',
  lg: 'h-control-large w-control-large px-0',
  icon: 'h-control-icon w-control-icon px-0',
};

export type IconButtonProps = Omit<
  ButtonProps,
  'accessibilityLabel' | 'children' | 'labelClassName'
> & {
  /** Required (unlike `Button`'s optional label): an icon-only button has no text content to infer an accessible name from. */
  accessibilityLabel: string;
  children: React.ReactNode;
  /**
   * A small overlay badge anchored to the top-end corner (e.g. an unread
   * count on a notification bell). A `number`/`string` renders inside a
   * pill and is appended to `accessibilityLabel` so the count is announced;
   * any other node renders as-is and must carry its own accessible text if
   * it needs to be announced. Omit for no badge (the default).
   */
  count?: React.ReactNode;
  /** Applied to the count badge's own container; has no effect when `count` is omitted. */
  countClassName?: string;
};

export const IconButton = React.forwardRef<React.ComponentRef<typeof Button>, IconButtonProps>(
  ({ accessibilityLabel, children, className, count, countClassName, size, style, ...props }, ref) => {
    const countText = typeof count === 'string' || typeof count === 'number' ? String(count) : undefined;
    const resolvedAccessibilityLabel = countText ? `${accessibilityLabel}, ${countText}` : accessibilityLabel;
    const resolvedSize = size ?? 'icon';
    const resolvedButtonClassName = cn(iconButtonSizeClassName[resolvedSize], className);

    // No `count`: render the `Button` as the sole, outermost node — the same
    // layout root IconButton had before the badge overlay existed — so a
    // caller's own layout className (`flex-1`, `self-center`, ...) or `style`
    // keeps applying to the element the caller's parent actually lays out,
    // instead of an extra wrapping `View` that only IconButton knows about.
    if (count === undefined) {
      return (
        <Button
          ref={ref}
          {...props}
          accessibilityLabel={resolvedAccessibilityLabel}
          className={resolvedButtonClassName}
          size="icon"
          style={style}
        >
          {children}
        </Button>
      );
    }

    // A `count` renders a badge, which needs an outer `View` to anchor the
    // badge's absolute position against. That wrapper is otherwise invisible
    // to layout: it also receives the caller's `className`/`style` so a
    // layout prop still lands on the outermost node exactly as it would with
    // no badge, while the inner `Button` keeps the same classes/style for its
    // own visual sizing.
    // A `number`/`string` count renders inside the pill and is already
    // announced via `resolvedAccessibilityLabel` above, so the badge
    // container itself stays `aria-hidden` to assistive tech (avoiding a
    // duplicate announcement). Any other node is documented to carry its own
    // accessible text, so the container must NOT be `aria-hidden` for that
    // case, or that text would never reach assistive tech at all.
    const isCustomCountNode = countText === undefined;
    // The wrapper is a plain `View`, not a `Pressable` — it can't host the
    // press-state style callback form `Button`/`Pressable` accept, so only a
    // static style object (the overwhelmingly common case) forwards to it.
    const wrapperStyle = typeof style === 'function' ? undefined : style;

    return (
      <View className={cn('relative', className)} style={wrapperStyle}>
        <Button
          ref={ref}
          {...props}
          accessibilityLabel={resolvedAccessibilityLabel}
          className={resolvedButtonClassName}
          size="icon"
        >
          {children}
        </Button>
        <View
          aria-hidden={isCustomCountNode ? undefined : true}
          className={cn(
            'absolute -end-1 -top-1 min-w-4 items-center justify-center rounded-full border border-surface bg-destructive px-1',
            countClassName,
          )}
        >
          {countText ? (
            <Text className="text-destructive-foreground" variant="caption">
              {countText}
            </Text>
          ) : (
            count
          )}
        </View>
      </View>
    );
  },
);

IconButton.displayName = 'IconButton';
