import { cn } from '@beemvp/beeui-core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type ActivityIndicatorProps,
  type PressableProps,
  type TextProps as RNTextProps,
} from 'react-native';
import { semanticTypographyClasses, Text } from './text';

// `max-w-full` (#144): a `Button` is a React Native-model flex item, whose
// default `flexShrink` is `0` (unlike CSS Web's default of `1`) — so, absent
// an explicit width constraint, an unusually long caller-supplied label
// (e.g. a long localized string/identifier) sizes the button to its full
// single-line intrinsic width regardless of its flex container's available
// space. Real evidence from #144's Playwright suite: a `SheetFooter`
// (`flex-row flex-wrap justify-end`) primary-action Button with a ~54-char
// label rendered ~540px wide inside a 348px-wide footer and, anchored by
// `justify-end`, extended ~170px off-screen past the left edge of a 390px
// viewport — the exact "clipped/off-screen primary action" #144's DoD
// forbids. `max-w-full` caps the button at its containing block's width so
// it shrinks (and its label wraps) instead of overflowing; it does not
// change `Button`'s documented, density-invariant `controlSize` height
// contract (`docs/dynamic-type.md`) — at every previously-audited label
// length this is a no-op, since normal labels already render narrower than
// their container.
const buttonVariants = cva(
  'flex-row items-center justify-center gap-2 rounded-md border max-w-full web:focus-visible:bee-focus-ring',
  {
    variants: {
      variant: {
        primary:
          'border-primary bg-primary active:bg-primary-pressed web:hover:bg-primary-hover',
        secondary:
          'border-secondary bg-secondary active:bg-secondary-pressed web:hover:bg-secondary-hover',
        outline:
          'border-border-strong bg-surface active:bg-muted web:hover:bg-surface-muted',
        ghost: 'border-transparent bg-transparent active:bg-muted web:hover:bg-surface-muted',
        destructive:
          'border-destructive bg-destructive active:bg-destructive-pressed web:hover:bg-destructive-hover',
      },
      // `min-h-*` (not `h-*`): a fixed height clips a label that wraps onto a
      // second line at large text scale (`ButtonLabel`'s own `numberOfLines`
      // is honored — see `buttonLabelVariants`/`Button`'s render below — but a
      // *fixed*-height flex parent still crops the wrapped second line's
      // pixels regardless of how many lines the `Text` itself is willing to
      // lay out). A minimum keeps every previously-audited single-line label
      // pixel-identical (content already renders shorter than the floor) and
      // lets the control grow instead of clipping once a label needs two
      // lines, e.g. a long localized checkout CTA under Dynamic Type.
      size: {
        sm: 'min-h-control-compact px-3 ios:min-h-touch-target android:min-h-touch-target',
        md: 'min-h-control-default px-4',
        lg: 'min-h-control-large px-5',
        icon: 'h-control-icon w-control-icon px-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

// `text-center`: a label that wraps (a long localized CTA, large text) must
// centre every line inside the button the way a single line is centred by the
// row's `justify-center`. It is a no-op for a single line, whose box already
// hugs its text.
const buttonLabelVariants = cva('font-semibold text-center', {
  variants: {
    variant: {
      primary: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      outline: 'text-foreground',
      ghost: 'text-foreground',
      destructive: 'text-destructive-foreground',
    },
    size: {
      sm: semanticTypographyClasses.label,
      md: semanticTypographyClasses.label,
      lg: semanticTypographyClasses.body,
      icon: semanticTypographyClasses.label,
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;

type EngineActivityIndicatorProps = ActivityIndicatorProps & {
  colorClassName?: string;
};

const EngineActivityIndicator = ActivityIndicator as React.ComponentType<EngineActivityIndicatorProps>;

const spinnerColorByVariant: Record<ButtonVariant, string> = {
  primary: 'accent-primary-foreground',
  secondary: 'accent-secondary-foreground',
  outline: 'accent-foreground',
  ghost: 'accent-foreground',
  destructive: 'accent-destructive-foreground',
};

export type ButtonProps = Omit<PressableProps, 'accessibilityRole' | 'role' | 'children'> &
  VariantProps<typeof buttonVariants> & {
    children?: React.ReactNode;
    className?: string;
    labelClassName?: string;
    /** Shows a spinner in place of the label, sets `aria-busy`, and disables presses. Defaults to false. */
    loading?: boolean;
  };

export const Button = React.forwardRef<React.ComponentRef<typeof Pressable>, ButtonProps>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      children,
      className,
      disabled,
      labelClassName,
      loading = false,
      size,
      variant,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const resolvedVariant: ButtonVariant = variant ?? 'primary';
    const childArray = React.Children.toArray(children);
    const inferredLabel = childArray.every(
      (child) => typeof child === 'string' || typeof child === 'number',
    )
      ? childArray.map(String).join('')
      : undefined;

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? inferredLabel}
        accessibilityRole="button"
        accessibilityState={{
          ...accessibilityState,
          disabled: isDisabled,
        }}
        // `aria-busy` (not `accessibilityState.busy`) is what carries the loading state on
        // Web: verified against react-native-web 0.21's source — `createDOMProps` reads the
        // individual `aria-busy`/`accessibilityBusy` props directly, and `accessibilityState`
        // never appears there or in Pressable/View's forwarded-prop allowlist, so a compound
        // `accessibilityState={{ busy }}` is silently dropped on Web and never reaches the DOM
        // as `aria-busy`. On native, React Native's own Pressable (0.86) normalizes `aria-busy`
        // into `accessibilityState.busy` internally (`busy: ariaBusy ?? accessibilityState?.busy`),
        // so a single `aria-busy` prop is the correct, verified way to expose loading/busy on
        // both platforms from the Button itself.
        aria-busy={loading}
        className={cn(
          buttonVariants({ variant: resolvedVariant, size }),
          isDisabled && 'border-disabled bg-disabled opacity-60',
          className,
        )}
        disabled={isDisabled}
      >
        {loading ? (
          <EngineActivityIndicator
            // react-native-web's ActivityIndicator always renders `role="progressbar"`
            // (WAI-ARIA `accessibleNameRequired`) and it cannot be suppressed by the caller.
            // The Button itself already exposes the loading state via `aria-busy` above and
            // keeps its own accessible name, so this inner indicator is purely visual —
            // `aria-hidden` (verified: a first-class prop on both react-native's ViewProps
            // and react-native-web's forwarded-accessibility-prop allowlist) removes it from
            // the accessibility tree instead of giving it a second, redundant accessible name.
            aria-hidden
            colorClassName={spinnerColorByVariant[resolvedVariant]}
            size="small"
          />
        ) : null}
        {childArray.map((child, index) => {
          if (typeof child === 'string' || typeof child === 'number') {
            return (
              <Text
                key={`button-label-${index}`}
                className={cn(
                  buttonLabelVariants({ variant: resolvedVariant, size }),
                  isDisabled && 'text-disabled-foreground',
                  labelClassName,
                )}
                variant="label"
              >
                {child}
              </Text>
            );
          }

          // An explicit `<ButtonLabel>` child previously passed straight
          // through unmodified: it never received this `Button`'s own
          // resolved `variant`/`size`, so it fell back to `ButtonLabel`'s own
          // cva defaults (`variant: 'primary'`) regardless of what `variant`
          // was actually passed to `Button` — e.g. `labelClassName` silently
          // had no effect, and `<DialogTrigger variant="outline">` (which
          // renders `Button` under the hood) painted a `text-primary-foreground`
          // label over an `outline` fill instead of `text-foreground`, an
          // unreadable ~1.1:1 combination in dark. Cloning it with the
          // resolved variant/size as a fallback (an explicit `variant`/`size`
          // on the child itself still wins) and merging `labelClassName`
          // ahead of the child's own `className` (so the child can still
          // override) makes an explicit `ButtonLabel` child behave exactly
          // like the string-child case above.
          if (React.isValidElement<ButtonLabelProps>(child) && child.type === ButtonLabel) {
            return React.cloneElement(child, {
              key: `button-label-${index}`,
              className: cn(
                isDisabled && 'text-disabled-foreground',
                labelClassName,
                child.props.className,
              ),
              size: child.props.size ?? size,
              variant: child.props.variant ?? resolvedVariant,
            });
          }

          return child;
        })}
      </Pressable>
    );
  },
);

Button.displayName = 'Button';

export type ButtonLabelProps = RNTextProps &
  VariantProps<typeof buttonLabelVariants> & {
    className?: string;
  };

export function ButtonLabel({ className, size, variant, ...props }: ButtonLabelProps) {
  return (
    <Text className={cn(buttonLabelVariants({ variant, size }), className)} variant="label" {...props} />
  );
}

export { buttonLabelVariants, buttonVariants };
