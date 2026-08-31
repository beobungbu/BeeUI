import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { Text, type TextProps } from './text';

export type LabelProps = Omit<TextProps, 'variant'> & {
  required?: boolean;
  requiredAccessibilityLabel?: string;
};

export const Label = React.forwardRef<React.ComponentRef<typeof Text>, LabelProps>(
  (
    {
      accessibilityLabel,
      children,
      className,
      required = false,
      requiredAccessibilityLabel = 'required',
      ...props
    },
    ref,
  ) => {
    const childArray = React.Children.toArray(children);
    const inferredLabel = childArray.every(
      (child) => typeof child === 'string' || typeof child === 'number',
    )
      ? childArray.map(String).join('')
      : undefined;
    const resolvedAccessibilityLabel =
      accessibilityLabel ??
      (required && inferredLabel ? `${inferredLabel}, ${requiredAccessibilityLabel}` : undefined);

    return (
      <Text
        ref={ref}
        {...props}
        accessibilityLabel={resolvedAccessibilityLabel}
        className={cn('shrink-0', className)}
        variant="label"
      >
        {children}
        {required ? (
          <Text
            accessibilityElementsHidden
            aria-hidden
            importantForAccessibility="no-hide-descendants"
            tone="destructive"
            variant="label"
          >
            {' *'}
          </Text>
        ) : null}
      </Text>
    );
  },
);

Label.displayName = 'Label';
