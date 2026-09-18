import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { Text, type TextProps } from './text';

export type LabelProps = Omit<TextProps, 'variant'> & {
  /** Internal — set by `Field`/`FormGroup` on the `Label` they render for a child control that already derives its own accessible name via `accessibilityLabelledBy` pointing at this `Label`'s `nativeID`, so the name lives once on that association (matching native `<label for>` semantics) rather than being duplicated onto the label element itself, even when `required` is true. Not meant for direct standalone `Label` usage. Defaults to false. */
  presentational?: boolean;
  /** Appends a visual `*` (hidden from accessibility) and, when the label's children are a plain string or number, appends `requiredAccessibilityLabel` to the accessible name instead. Defaults to false. */
  required?: boolean;
  /** Text appended to the accessible name after the label when `required` is true and the label's children are a plain string or number (e.g. `"Email, required"`). Defaults to `'required'`. */
  requiredAccessibilityLabel?: string;
};

export const Label = React.forwardRef<React.ComponentRef<typeof Text>, LabelProps>(
  (
    {
      accessibilityLabel,
      children,
      className,
      presentational = false,
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
    const resolvedAccessibilityLabel = presentational
      ? undefined
      : (accessibilityLabel ??
        (required && inferredLabel ? `${inferredLabel}, ${requiredAccessibilityLabel}` : undefined));

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
