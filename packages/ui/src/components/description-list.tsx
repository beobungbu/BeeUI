import { cn } from '@beeui/core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { MetadataRow, type MetadataRowProps } from './metadata-row';

export type DescriptionListProps = ViewProps & {
  className?: string;
};

export const DescriptionList = React.forwardRef<React.ComponentRef<typeof View>, DescriptionListProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn('w-full gap-1', className)} {...props} />
  ),
);

DescriptionList.displayName = 'DescriptionList';

export type DescriptionItemProps = MetadataRowProps;

export const DescriptionItem = React.forwardRef<
  React.ComponentRef<typeof View>,
  DescriptionItemProps
>(({ className, ...props }, ref) => (
  <MetadataRow ref={ref} className={cn('rounded-md px-2', className)} {...props} />
));

DescriptionItem.displayName = 'DescriptionItem';
