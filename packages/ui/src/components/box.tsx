import * as React from 'react';
import { View as RNView, type ViewProps } from 'react-native';

export type BoxProps = ViewProps & {
  className?: string;
};

export const Box = React.forwardRef<React.ComponentRef<typeof RNView>, BoxProps>(
  ({ className, ...props }, ref) => <RNView ref={ref} className={className} {...props} />,
);

Box.displayName = 'Box';
