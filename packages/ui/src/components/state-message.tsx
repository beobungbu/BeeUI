import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { Text } from './text';

export type EmptyStateProps = Omit<ViewProps, 'children'> & {
  /** Rendered below the description with top padding (e.g. a retry or create button). */
  action?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  /** Rendered above the title, hidden from accessibility (purely decorative). */
  icon?: React.ReactNode;
  title: React.ReactNode;
};

export const EmptyState = React.forwardRef<React.ComponentRef<typeof View>, EmptyStateProps>(
  ({ action, className, description, icon, title, ...props }, ref) => (
    <View
      ref={ref}
      className={cn('w-full items-center gap-3 rounded-lg px-5 py-8', className)}
      {...props}
    >
      {icon ? <View accessible={false}>{icon}</View> : null}
      <View className="items-center gap-1">
        {typeof title === 'string' || typeof title === 'number' ? (
          <Text className="text-center" variant="heading">
            {title}
          </Text>
        ) : (
          title
        )}
        {description ? (
          typeof description === 'string' || typeof description === 'number' ? (
            <Text className="text-center" tone="muted">
              {description}
            </Text>
          ) : (
            description
          )
        ) : null}
      </View>
      {action ? <View className="pt-1">{action}</View> : null}
    </View>
  ),
);

EmptyState.displayName = 'EmptyState';

export type ErrorStateProps = Omit<EmptyStateProps, 'title'> & {
  title?: React.ReactNode;
};

export const ErrorState = React.forwardRef<React.ComponentRef<typeof View>, ErrorStateProps>(
  ({ description = 'Please try again.', title = 'Something went wrong', ...props }, ref) => (
    <EmptyState
      ref={ref}
      {...props}
      description={description}
      title={
        typeof title === 'string' || typeof title === 'number' ? (
          <Text className="text-center" tone="destructive" variant="heading">
            {title}
          </Text>
        ) : (
          title
        )
      }
    />
  ),
);

ErrorState.displayName = 'ErrorState';
