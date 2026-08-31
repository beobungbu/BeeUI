import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { Box } from './box';
import { Text } from './text';

export type SectionProps = ViewProps & {
  action?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  descriptionClassName?: string;
  title?: React.ReactNode;
  titleClassName?: string;
};

export const Section = React.forwardRef<React.ComponentRef<typeof View>, SectionProps>(
  (
    {
      action,
      children,
      className,
      description,
      descriptionClassName,
      title,
      titleClassName,
      ...props
    },
    ref,
  ) => (
    <View ref={ref} className={cn('w-full gap-3', className)} {...props}>
      {title || description || action ? (
        <Box className="flex-row items-start justify-between gap-4">
          <Box className="min-w-0 flex-1 gap-1">
            {title ? (
              typeof title === 'string' || typeof title === 'number' ? (
                <Text accessibilityRole="header" className={titleClassName} variant="heading">
                  {title}
                </Text>
              ) : (
                title
              )
            ) : null}
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
          {action ? <Box className="shrink-0">{action}</Box> : null}
        </Box>
      ) : null}
      {children}
    </View>
  ),
);

Section.displayName = 'Section';
