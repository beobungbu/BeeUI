import * as React from 'react';
import { Button, type ButtonProps } from './button';

export type IconButtonProps = Omit<
  ButtonProps,
  'accessibilityLabel' | 'children' | 'labelClassName' | 'size'
> & {
  /** Required (unlike `Button`'s optional label): an icon-only button has no text content to infer an accessible name from. */
  accessibilityLabel: string;
  children: React.ReactNode;
};

export const IconButton = React.forwardRef<
  React.ComponentRef<typeof Button>,
  IconButtonProps
>(({ accessibilityLabel, children, ...props }, ref) => (
  <Button
    ref={ref}
    {...props}
    accessibilityLabel={accessibilityLabel}
    size="icon"
  >
    {children}
  </Button>
));

IconButton.displayName = 'IconButton';
