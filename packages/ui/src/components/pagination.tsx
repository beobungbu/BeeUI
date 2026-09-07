import { cn } from '@beemvp/beeui-core';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { Text } from './text';
import { useDirection } from './use-direction';

type PaginationContextValue = {
  disabled: boolean;
  onPageChange?: (page: number) => void;
  page: number;
  pageCount: number;
};

const PaginationContext = React.createContext<PaginationContextValue | null>(null);

function usePaginationContext() {
  const context = React.useContext(PaginationContext);
  if (!context) throw new Error('PaginationItem must be rendered inside Pagination.');
  return context;
}

export type PaginationProps = Omit<ViewProps, 'children' | 'role'> & {
  children?: React.ReactNode;
  className?: string;
  /** Disables every `PaginationItem` inside, overriding each item's own `disabled`. Defaults to false. */
  disabled?: boolean;
  /** Called with the requested page number when a non-selected, in-range `PaginationItem` is pressed. Not called for the currently selected page or an out-of-range target. */
  onPageChange?: (page: number) => void;
  /** The current page, clamped to `[1, pageCount]`. Non-finite values fall back to 1. */
  page: number;
  /** Total number of pages. Non-finite or sub-1 values are floored and clamped to at least 1. */
  pageCount: number;
};

export const Pagination = React.forwardRef<React.ComponentRef<typeof View>, PaginationProps>(
  (
    {
      accessibilityLabel = 'Pagination',
      children,
      className,
      disabled = false,
      onPageChange,
      page,
      pageCount,
      ...props
    },
    ref,
  ) => {
    const normalizedPageCount = Number.isFinite(pageCount)
      ? Math.max(1, Math.floor(pageCount))
      : 1;
    const finitePage = Number.isFinite(page) ? Math.floor(page) : 1;
    const normalizedPage = Math.min(normalizedPageCount, Math.max(1, finitePage));
    const context = React.useMemo(
      () => ({ disabled, onPageChange, page: normalizedPage, pageCount: normalizedPageCount }),
      [disabled, normalizedPage, normalizedPageCount, onPageChange],
    );

    return (
      <PaginationContext.Provider value={context}>
        <View
          ref={ref}
          {...props}
          accessibilityLabel={accessibilityLabel}
          className={cn('flex-row flex-wrap items-center gap-2', className)}
        >
          {children}
        </View>
      </PaginationContext.Provider>
    );
  },
);

Pagination.displayName = 'Pagination';

export type PaginationItemType = 'page' | 'previous' | 'next';

type PaginationItemBaseProps = Omit<
  PressableProps,
  'accessibilityRole' | 'children' | 'role'
> & {
  children?: React.ReactNode;
  className?: string;
  labelClassName?: string;
};

type PaginationPageItemProps = PaginationItemBaseProps & {
  /**
   * Page number this item targets, starting at 1 and truncated toward zero; a
   * non-finite value renders the item as a disabled em dash. An item whose target
   * falls outside `[1, pageCount]` is also disabled.
   */
  page: number;
  /**
   * Marks this item as a page numeral rather than a navigation arrow, and renders
   * selected when its `page` is the current page. Defaults to `'page'`.
   */
  type?: 'page';
};

type PaginationNavigationItemProps = PaginationItemBaseProps & {
  /**
   * Not accepted on a navigation item, whose target is derived from the current
   * page: one before it for `'previous'`, one after it for `'next'`.
   */
  page?: never;
  /**
   * Which navigation affordance to render, as a logical rather than physical
   * direction, so `'previous'` points toward the visual right in an RTL layout.
   * The item is disabled when its derived target falls outside `[1, pageCount]`.
   */
  type: 'previous' | 'next';
};

export type PaginationItemProps = PaginationPageItemProps | PaginationNavigationItemProps;

export const PaginationItem = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  PaginationItemProps
>(
  (
    {
      accessibilityLabel,
      accessibilityState,
      children,
      className,
      disabled = false,
      labelClassName,
      onPress,
      page,
      type = 'page',
      ...props
    },
    ref,
  ) => {
    const pagination = usePaginationContext();
    // Previous/next are logical navigation affordances, not physical sides: in an
    // RTL layout "previous" points toward the end (visual right) and "next" toward
    // the start (visual left). The default chevron glyphs therefore mirror with the
    // resolved direction (ADR-004 logical start/end mapping). Numerals and the
    // invalid-page em dash stay physical — they are not directional content.
    const direction = useDirection();
    const previousGlyph = direction === 'rtl' ? '›' : '‹';
    const nextGlyph = direction === 'rtl' ? '‹' : '›';
    const invalidPageItem = type === 'page' && !Number.isFinite(page);
    const requestedPage = Number.isFinite(page) ? Math.floor(page as number) : pagination.page;
    const targetPage =
      type === 'previous'
        ? pagination.page - 1
        : type === 'next'
          ? pagination.page + 1
          : requestedPage;
    const selected = type === 'page' && !invalidPageItem && targetPage === pagination.page;
    const outOfRange = targetPage < 1 || targetPage > pagination.pageCount;
    const isDisabled = disabled || pagination.disabled || invalidPageItem || outOfRange;
    const childArray = React.Children.toArray(children);
    const fallbackContent =
      type === 'previous'
        ? previousGlyph
        : type === 'next'
          ? nextGlyph
          : invalidPageItem
            ? '—'
            : String(targetPage);
    const inferredLabel =
      type === 'previous'
        ? 'Previous page'
        : type === 'next'
          ? 'Next page'
          : invalidPageItem
            ? 'Page'
            : `Page ${targetPage}`;

    React.useEffect(() => {
      if (typeof __DEV__ !== 'undefined' && __DEV__ && invalidPageItem) {
        console.warn(
          'BeeUI PaginationItem: `type="page"` requires a finite `page` number. The item is disabled until a valid page is provided.',
        );
      }
    }, [invalidPageItem]);

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? inferredLabel}
        accessibilityRole="button"
        accessibilityState={{ ...accessibilityState, disabled: isDisabled, selected }}
        className={cn(
          'min-h-10 min-w-10 items-center justify-center rounded-md border px-3 py-2 active:opacity-80',
          selected
            ? 'border-primary bg-primary'
            : 'border-border-strong bg-surface web:hover:bg-surface-muted',
          isDisabled && 'opacity-50',
          className,
        )}
        disabled={isDisabled}
        onPress={(event) => {
          onPress?.(event);
          if (!selected && !isDisabled) pagination.onPageChange?.(targetPage);
        }}
      >
        {(childArray.length > 0 ? childArray : [fallbackContent]).map((child, index) =>
          typeof child === 'string' || typeof child === 'number' ? (
            <Text
              key={`pagination-item-label-${index}`}
              className={cn(
                selected ? 'text-primary-foreground' : 'text-foreground',
                labelClassName,
              )}
              variant="label"
            >
              {child}
            </Text>
          ) : (
            child
          ),
        )}
      </Pressable>
    );
  },
);

PaginationItem.displayName = 'PaginationItem';
