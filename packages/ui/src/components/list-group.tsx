import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { Box } from './box';
import { Text } from './text';

// Private composition channel between `ListGroup` and `ListItem`/`SettingsItem` — not
// re-exported from the package entry point. It lets a `ListItem` know, purely from its
// position in the React tree, whether it is owned by a `ListGroup`'s `role="list"`
// container. WAI-ARIA's Required Context Role (5.2.7) makes `listitem` semantics
// meaningful only inside a `list`-owning ancestor, so this is the local, non-global
// mechanism `ListItem` uses to decide whether to expose `listitem` ownership at all —
// no shared state/store, just a scoped Provider around `ListGroup`'s own children.
export const ListGroupMembershipContext = React.createContext(false);

export type ListGroupProps = Omit<ViewProps, 'accessibilityRole' | 'role'> & {
  className?: string;
};

export const ListGroup = React.forwardRef<React.ComponentRef<typeof View>, ListGroupProps>(
  ({ children, className, ...props }, ref) => (
    <View
      ref={ref}
      {...props}
      accessibilityRole="list"
      className={cn('overflow-hidden rounded-xl border border-border bg-surface', className)}
    >
      <ListGroupMembershipContext.Provider value={true}>{children}</ListGroupMembershipContext.Provider>
    </View>
  ),
);

ListGroup.displayName = 'ListGroup';

export type ListGroupHeaderProps = Omit<ViewProps, 'children'> & {
  className?: string;
  description?: React.ReactNode;
  title: React.ReactNode;
  trailing?: React.ReactNode;
};

export const ListGroupHeader = React.forwardRef<
  React.ComponentRef<typeof View>,
  ListGroupHeaderProps
>(({ className, description, title, trailing, ...props }, ref) => (
  <View
    ref={ref}
    className={cn('flex-row items-start gap-3 border-b border-border bg-surface-muted px-3 py-3', className)}
    {...props}
  >
    <Box className="min-w-0 flex-1 gap-0.5">
      {typeof title === 'string' || typeof title === 'number' ? (
        <Text variant="label">{title}</Text>
      ) : (
        title
      )}
      {description ? (
        typeof description === 'string' || typeof description === 'number' ? (
          <Text tone="muted" variant="caption">
            {description}
          </Text>
        ) : (
          description
        )
      ) : null}
    </Box>
    {trailing ? <Box className="shrink-0">{trailing}</Box> : null}
  </View>
));

ListGroupHeader.displayName = 'ListGroupHeader';
