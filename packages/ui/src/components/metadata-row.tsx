import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { Box } from './box';
import { Text } from './text';

export type MetadataRowProps = Omit<ViewProps, 'children'> & {
  className?: string;
  description?: React.ReactNode;
  label: React.ReactNode;
  /** Rendered end-aligned opposite the label, in a column capped at 60% of the row's width. */
  value: React.ReactNode;
};

export const MetadataRow = React.forwardRef<React.ComponentRef<typeof View>, MetadataRowProps>(
  ({ className, description, label, value, ...props }, ref) => (
    <View ref={ref} className={cn('w-full flex-row items-start gap-4 py-2', className)} {...props}>
      <Box className="min-w-0 flex-1 gap-0.5">
        {typeof label === 'string' || typeof label === 'number' ? (
          <Text tone="muted" variant="caption">{label}</Text>
        ) : (
          label
        )}
        {description ? (
          typeof description === 'string' || typeof description === 'number' ? (
            <Text tone="subtle" variant="caption">{description}</Text>
          ) : (
            description
          )
        ) : null}
      </Box>
      <Box className="max-w-[60%] items-end">
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text className="text-end" variant="label">{value}</Text>
        ) : (
          value
        )}
      </Box>
    </View>
  ),
);

MetadataRow.displayName = 'MetadataRow';
