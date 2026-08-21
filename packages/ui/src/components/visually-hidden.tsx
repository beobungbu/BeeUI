import * as React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

export type VisuallyHiddenProps = ViewProps & {
  /**
   * VisuallyHidden is intended for non-interactive assistive text/content.
   * Interactive controls should expose their own accessibility label instead.
   */
  children?: React.ReactNode;
};

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
});

export const VisuallyHidden = React.forwardRef<React.ComponentRef<typeof View>, VisuallyHiddenProps>(
  ({ pointerEvents = 'none', style, ...props }, ref) => (
    <View
      ref={ref}
      {...props}
      collapsable={false}
      pointerEvents={pointerEvents}
      style={[style, styles.hidden]}
    />
  ),
);

VisuallyHidden.displayName = 'VisuallyHidden';
