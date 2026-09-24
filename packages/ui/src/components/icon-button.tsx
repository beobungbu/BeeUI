import { cn } from '@beemvp/beeui-core';
import { controlSize } from '@beemvp/beeui-tokens';
import * as React from 'react';
import { Platform, View } from 'react-native';
import { Button, type ButtonProps } from './button';
import { Text } from './text';

// `Button`'s own `size` variants (`sm`/`md`/`lg`) size a *rectangular* control
// with horizontal label padding, and its `icon` size carries its own square
// height/width classes. IconButton therefore renders `Button` with
// no size variant at all and owns the whole square geometry here: the
// control-height tokens `Button` uses for height (`--spacing-control-*`) serve
// as both height and width. Passing `Button size="icon"` and overriding it
// through `className` does not work — tailwind-merge does not recognise the
// token names as conflicting `h-*`/`w-*` values, so both size classes reached
// the element and stylesheet order decided the size (`lg` happened to win,
// `sm` rendered at the icon size).
const iconButtonSizeClassName: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-control-compact w-control-compact px-0',
  md: 'h-control-default w-control-default px-0',
  lg: 'h-control-large w-control-large px-0',
  icon: 'h-control-icon w-control-icon px-0',
};

// Native touch targets have a 44dp floor (`controlSize.touchTarget`). `sm`'s
// visual box is smaller, so on iOS/Android its tappable region is extended by
// `hitSlop` rather than by a `min-h`/`min-w` guard, which would grow the
// visual box back to 44 and make `sm` indistinguishable from the default.
// Web keeps the visual size as the pointer target, like `Button size="sm"`.
const smallTouchTargetSlop = (controlSize.touchTarget - controlSize.compact) / 2;
const smallHitSlop = {
  bottom: smallTouchTargetSlop,
  left: smallTouchTargetSlop,
  right: smallTouchTargetSlop,
  top: smallTouchTargetSlop,
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
  ({ accessibilityLabel, children, className, count, countClassName, hitSlop, size, style, ...props }, ref) => {
    const countText = typeof count === 'string' || typeof count === 'number' ? String(count) : undefined;
    const resolvedAccessibilityLabel = countText ? `${accessibilityLabel}, ${countText}` : accessibilityLabel;
    const resolvedSize = size ?? 'icon';
    const resolvedButtonClassName = cn('relative', iconButtonSizeClassName[resolvedSize], className);
    const isCustomCountNode = countText === undefined;
    const resolvedHitSlop =
      hitSlop ?? (resolvedSize === 'sm' && Platform.OS !== 'web' ? smallHitSlop : undefined);

    return (
      <Button ref={ref} {...props} accessibilityLabel={resolvedAccessibilityLabel} className={resolvedButtonClassName} hitSlop={resolvedHitSlop} size={null} style={style}>
        {children}
        {count === undefined ? null : (
          <View aria-hidden={isCustomCountNode ? undefined : true} className={cn('absolute -end-1 -top-1 min-w-4 items-center justify-center rounded-full border border-surface bg-destructive px-1', countClassName)} pointerEvents="none">
            {countText !== undefined ? <Text className="text-destructive-foreground" variant="caption">{countText}</Text> : count}
          </View>
        )}
      </Button>
    );
  },
);

IconButton.displayName = 'IconButton';
