import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { Box } from './box';
import { Text } from './text';

function getTimelineChildKey(item: React.ReactNode, index: number) {
  return React.isValidElement(item) && item.key != null ? item.key : `timeline-item-${index}`;
}

type TimelineItemContextValue = {
  last: boolean;
};

const TimelineItemContext = React.createContext<TimelineItemContextValue>({ last: false });

export type TimelineProps = Omit<ViewProps, 'children'> & {
  children?: React.ReactNode;
  className?: string;
};

export const Timeline = React.forwardRef<React.ComponentRef<typeof View>, TimelineProps>(
  ({ children, className, ...props }, ref) => {
    const items = React.Children.toArray(children);

    return (
      <View ref={ref} className={cn('w-full', className)} {...props}>
        {items.map((item, index) => (
          <TimelineItemContext.Provider
            key={getTimelineChildKey(item, index)}
            value={{ last: index === items.length - 1 }}
          >
            {item}
          </TimelineItemContext.Provider>
        ))}
      </View>
    );
  },
);

Timeline.displayName = 'Timeline';

type TimelineStatus = 'default' | 'primary' | 'success' | 'destructive';

const markerClasses: Record<TimelineStatus, string> = {
  default: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  destructive: 'bg-destructive',
};

export type TimelineItemProps = Omit<ViewProps, 'children'> & {
  className?: string;
  description?: React.ReactNode;
  marker?: React.ReactNode;
  meta?: React.ReactNode;
  status?: TimelineStatus;
  title: React.ReactNode;
};

export const TimelineItem = React.forwardRef<React.ComponentRef<typeof View>, TimelineItemProps>(
  (
    {
      className,
      description,
      marker,
      meta,
      status = 'default',
      title,
      ...props
    },
    ref,
  ) => {
    const { last } = React.useContext(TimelineItemContext);

    return (
      <View ref={ref} className={cn('flex-row gap-3', className)} {...props}>
        <View
          accessibilityElementsHidden
          className="relative w-4 shrink-0 items-center"
          importantForAccessibility="no-hide-descendants"
        >
          {marker ?? <View className={cn('mt-1.5 h-3 w-3 rounded-full', markerClasses[status])} />}
          {!last ? <View className="absolute bottom-0 top-5 w-px bg-border" /> : null}
        </View>
        <Box className={cn('min-w-0 flex-1 gap-1', !last && 'pb-5')}>
          {typeof title === 'string' || typeof title === 'number' ? (
            <Text variant="label">{title}</Text>
          ) : (
            title
          )}
          {description ? (
            typeof description === 'string' || typeof description === 'number' ? (
              <Text tone="muted" variant="body">
                {description}
              </Text>
            ) : (
              description
            )
          ) : null}
          {meta ? (
            typeof meta === 'string' || typeof meta === 'number' ? (
              <Text tone="subtle" variant="caption">
                {meta}
              </Text>
            ) : (
              meta
            )
          ) : null}
        </Box>
      </View>
    );
  },
);

TimelineItem.displayName = 'TimelineItem';
