import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { Text, type TextProps } from './text';

export type StatProps = ViewProps & {
  className?: string;
};

export const Stat = React.forwardRef<React.ComponentRef<typeof View>, StatProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn('min-w-0 gap-1', className)} {...props} />
  ),
);

Stat.displayName = 'Stat';

export type StatLabelProps = Omit<TextProps, 'variant'>;

export const StatLabel = React.forwardRef<React.ComponentRef<typeof Text>, StatLabelProps>(
  ({ tone = 'muted', ...props }, ref) => <Text ref={ref} {...props} tone={tone} variant="caption" />,
);

StatLabel.displayName = 'StatLabel';

export type StatValueProps = Omit<TextProps, 'variant'>;

export const StatValue = React.forwardRef<React.ComponentRef<typeof Text>, StatValueProps>(
  (props, ref) => <Text ref={ref} {...props} variant="title" />,
);

StatValue.displayName = 'StatValue';

export type StatHelpTextProps = Omit<TextProps, 'variant'>;

export const StatHelpText = React.forwardRef<React.ComponentRef<typeof Text>, StatHelpTextProps>(
  ({ tone = 'muted', ...props }, ref) => <Text ref={ref} {...props} tone={tone} variant="caption" />,
);

StatHelpText.displayName = 'StatHelpText';
