import { cn } from '@beemvp/beeui-core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

const cardVariants = cva('rounded-lg', {
  variants: {
    variant: {
      surface: 'bg-surface',
      outlined: 'border border-border bg-surface',
      raised: 'border border-border bg-surface-raised shadow-raised',
      muted: 'bg-surface-muted',
    },
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    },
  },
  defaultVariants: {
    variant: 'outlined',
    padding: 'md',
  },
});

export type CardProps = ViewProps &
  VariantProps<typeof cardVariants> & {
    className?: string;
  };

export const Card = React.forwardRef<React.ComponentRef<typeof View>, CardProps>(
  ({ className, padding, variant, ...props }, ref) => (
    <View ref={ref} className={cn(cardVariants({ padding, variant }), className)} {...props} />
  ),
);

Card.displayName = 'Card';

export { cardVariants };
