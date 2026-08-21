import { cn } from '@beeui/core';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import { Text } from './text';

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
  disabled?: boolean;
  onPageChange?: (page: number) => void;
  page: number;
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
    const normalizedPageCount = Math.max(1, Math.floor(pageCount));
    const normalizedPage = Math.min(normalizedPageCount, Math.max(1, Math.floor(page)));
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

export type PaginationItemProps = Omit<
  PressableProps,
  'accessibilityRole' | 'accessibilityState' | 'children' | 'role'
> & {
  children?: React.ReactNode;
  className?: string;
  labelClassName?: string;
  page?: number;
  type?: PaginationItemType;
};

export const PaginationItem = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  PaginationItemProps
>(
  (
    {
      accessibilityLabel,
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
    const targetPage =
      type === 'previous'
        ? pagination.page - 1
        : type === 'next'
          ? pagination.page + 1
          : Math.floor(page ?? pagination.page);
    const selected = type === 'page' && targetPage === pagination.page;
    const outOfRange = targetPage < 1 || targetPage > pagination.pageCount;
    const isDisabled = disabled || pagination.disabled || outOfRange;
    const childArray = React.Children.toArray(children);
    const fallbackContent = type === 'previous' ? '‹' : type === 'next' ? '›' : String(targetPage);
    const inferredLabel =
      type === 'previous'
        ? 'Previous page'
        : type === 'next'
          ? 'Next page'
          : `Page ${targetPage}`;

    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? inferredLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, selected }}
        className={cn(
          'h-10 min-w-10 items-center justify-center rounded-md border px-3 active:opacity-80',
          selected
            ? 'border-primary bg-primary'
            : 'border-border-strong bg-surface web:hover:bg-surface-muted',
          isDisabled && 'opacity-50',
          className,
        )}
        disabled={isDisabled}
        onPress={(event) => {
          onPress?.(event);
          if (!selected && !outOfRange) pagination.onPageChange?.(targetPage);
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
