import { cn } from '@beeui/core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { Box } from './box';
import { Text } from './text';

export type ListGroupProps = ViewProps & {
  className?: string;
};

export const ListGroup = React.forwardRef<React.ComponentRef<typeof View>, ListGroupProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn('overflow-hidden rounded-xl border border-border bg-surface', className)}
      {...props}
    />
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
    className={cn('flex-row items-start gap-3 border-b border-border bg-surface-muted px-4 py-3', className)}
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
