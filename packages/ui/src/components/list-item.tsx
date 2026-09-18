import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { Box } from './box';
import { ListGroupMembershipContext } from './list-group';
import { Text } from './text';

// A `title`/`description`/`trailing` built from a plain string/number always
// produced an accessible name (below). A two-value row built from a *node*
// instead (e.g. `title={<View><Text>Wi-Fi</Text><Text>On</Text></View>}`)
// previously fell through every check here and rendered with no accessible
// name at all — `role="button"` announced with nothing to act on. Walking
// each node's own `children` and collecting every string/number leaf
// recovers the same name a sighted user reads, the same way `Dialog`'s
// `getPrimitiveText` derives a title from simple children, generalized to
// arbitrary nesting. An element with no text-bearing descendants (a
// standalone icon) still yields no name, exactly as before — callers with
// genuinely non-textual content still need an explicit `accessibilityLabel`.
function collectAccessibilityText(value: React.ReactNode, parts: string[]) {
  if (value == null || typeof value === 'boolean') return;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    if (text) parts.push(text);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectAccessibilityText(item, parts));
    return;
  }
  if (React.isValidElement(value)) {
    collectAccessibilityText((value.props as { children?: React.ReactNode }).children, parts);
  }
}

function getAccessibilityLabel(...values: React.ReactNode[]): string | undefined {
  const parts: string[] = [];
  values.forEach((value) => collectAccessibilityText(value, parts));
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function renderSettingsValue(value: React.ReactNode) {
  return typeof value === 'string' || typeof value === 'number' ? (
    <Text tone="muted" variant="label">
      {value}
    </Text>
  ) : (
    value
  );
}

export type ListItemProps = Omit<
  PressableProps,
  'accessibilityRole' | 'accessibilityState' | 'children' | 'role'
> & {
  /**
   * Marks this row as the current/selected item — e.g. the active sidebar
   * link, or a selected row in a master/detail list. Adds a tokenized
   * selected background plus `accessibilityState.selected` (native) and
   * `aria-current` (Web, since `accessibilityState` is not forwarded to the
   * DOM there — see the `aria-current` prop below). Defaults to false.
   */
  active?: boolean;
  className?: string;
  description?: React.ReactNode;
  /** Applied to the description `Text` when `description` is a plain string or number; ignored if `description` is a custom element. */
  descriptionClassName?: string;
  /** Rendered before the title/description column, shrink-to-content (e.g. an icon or avatar). */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** Applied to the title `Text` when `title` is a plain string or number; ignored if `title` is a custom element. */
  titleClassName?: string;
  trailing?: React.ReactNode;
};

export const ListItem = React.forwardRef<React.ComponentRef<typeof Pressable>, ListItemProps>(
  (
    {
      accessibilityLabel,
      active = false,
      className,
      description,
      descriptionClassName,
      disabled = false,
      leading,
      onPress,
      title,
      titleClassName,
      trailing,
      ...props
    },
    ref,
  ) => {
    const interactive = typeof onPress === 'function';
    const isDisabled = disabled === true;
    const inferredLabel = getAccessibilityLabel(title, description, trailing);
    const groupPrimitiveContent = !interactive && inferredLabel !== undefined;
    // WAI-ARIA Required Context Role (5.2.7): `listitem` is only meaningful when owned by
    // a `list`. A standalone ListItem (rendered outside `ListGroup`) has no such owner, so
    // it must stay semantically neutral — only a `ListGroup` ancestor (via this private,
    // package-internal context; see list-group.tsx) authorizes `listitem` ownership.
    const insideListGroup = React.useContext(ListGroupMembershipContext);

    const row = (
      <Pressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? inferredLabel}
        accessibilityRole={interactive ? 'button' : undefined}
        accessibilityState={
          interactive || active ? { disabled: interactive ? isDisabled : undefined, selected: active || undefined } : undefined
        }
        // `accessibilityState.selected` above is native-only-effective (see
        // Chip/Button: react-native-web never forwards `accessibilityState`
        // to the DOM). `aria-selected` is not a substitute here — it is only
        // an ARIA-allowed attribute on roles like `option`/`row`/`tab`, never
        // on this row's actual `button`/`listitem`/no-role output (the same
        // constraint `TableRow`'s stacked layout documents). `aria-current`
        // has no such role restriction, so it is the correct explicit Web
        // signal for "this is the current item" on a `button`/plain row.
        aria-current={active ? 'true' : undefined}
        // Non-interactive rows inside a ListGroup are the list's `listitem` themselves
        // (via the web-role `role` prop — `accessibilityRole`'s fixed, native-mask-synced
        // enum doesn't include `listitem`). Outside a ListGroup, no `listitem` role is
        // emitted at all (Required Context Role). Interactive rows never carry `listitem`
        // on the Pressable itself — when owned by a ListGroup they get a separate
        // `listitem`-role wrapper instead (see the wrapped return below), since a single
        // native element can't carry both `button` and `listitem` roles at once.
        role={!interactive && insideListGroup ? 'listitem' : undefined}
        accessible={interactive || groupPrimitiveContent || active ? true : undefined}
        className={cn(
          // Row height/gap come from the #74 application-density axis (`--spacing-density-*`,
          // default = comfortable = the pre-#74 `min-h-14`/`gap-3` literals, pixel-identical).
          // The native touch-target guard is unconditional (like Button's `sm` size) so a
          // `compact`-density row can never drop below the accepted native hit-target minimum.
          'min-h-density-row-height w-full flex-row items-center gap-density-row-gap rounded-md px-3 py-2 ios:min-h-touch-target android:min-h-touch-target',
          interactive && 'active:bg-surface-muted web:hover:bg-surface-muted',
          active && 'bg-primary/10',
          isDisabled && 'opacity-60',
          className,
        )}
        disabled={isDisabled || !interactive}
        onPress={onPress}
      >
        {leading ? <Box className="shrink-0">{leading}</Box> : null}
        <Box className="min-w-0 flex-1 gap-0.5">
          {typeof title === 'string' || typeof title === 'number' ? (
            <Text className={titleClassName} variant="label">
              {title}
            </Text>
          ) : (
            title
          )}
          {description ? (
            typeof description === 'string' || typeof description === 'number' ? (
              <Text className={descriptionClassName} tone="muted" variant="caption">
                {description}
              </Text>
            ) : (
              description
            )
          ) : null}
        </Box>
        {trailing ? <Box className="shrink-0">{trailing}</Box> : null}
      </Pressable>
    );

    // Interactive rows render `button`, not `listitem`, on the Pressable itself. When owned
    // by a ListGroup, wrap them in a plain `listitem` element so the list's `role="list"`
    // container's direct children conform to the ARIA `list` -> `listitem` contract — this
    // mirrors the standard `<li><button>` pattern. Outside a ListGroup there is no `list`
    // to satisfy, so a standalone interactive ListItem stays a plain button with no
    // orphan `listitem` wrapper.
    return interactive && insideListGroup ? (
      <Box className="w-full" role="listitem">
        {row}
      </Box>
    ) : (
      row
    );
  },
);

ListItem.displayName = 'ListItem';

export type SettingsItemProps = Omit<ListItemProps, 'trailing'> & {
  trailing?: React.ReactNode;
  /** Rendered muted, end-aligned before `trailing` (e.g. the current setting's selected option). Plain string/number renders as `Text`; anything else renders as-is. */
  value?: React.ReactNode;
};

export const SettingsItem = React.forwardRef<React.ComponentRef<typeof Pressable>, SettingsItemProps>(
  ({ accessibilityLabel, description, title, trailing, value, ...props }, ref) => {
    const renderedValue = value == null ? null : renderSettingsValue(value);
    const resolvedTrailing =
      renderedValue && trailing ? (
        <Box className="flex-row items-center gap-2">
          {renderedValue}
          {trailing}
        </Box>
      ) : (
        trailing ?? renderedValue
      );
    // `value ?? trailing` (not both): `value` (the current setting, e.g.
    // "On") is the meaningful trailing-position content when present;
    // `trailing` itself is then typically a purely decorative disclosure
    // chevron that must not leak into the accessible name alongside it.
    const inferredLabel = getAccessibilityLabel(title, description, value ?? trailing);

    return (
      <ListItem
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? inferredLabel}
        description={description}
        title={title}
        trailing={resolvedTrailing}
      />
    );
  },
);

SettingsItem.displayName = 'SettingsItem';
