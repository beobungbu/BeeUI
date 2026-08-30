import {
  addCalendarDays,
  addCalendarMonths,
  addCalendarYears,
  clampCalendarDate,
  cn,
  fromLocalDate,
  getCalendarMonthGrid,
  isCalendarDateDisabled,
  isSameCalendarDate,
  toISODateString,
  type AnchoredOverlayDirection,
  type CalendarDate,
  type CalendarWeekStartsOn,
} from '@beeui/core';
import * as React from 'react';
import { Platform, Pressable, View, type ViewProps } from 'react-native';
import {
  getCalendarDayAccessibilityLabel,
  getCalendarMonthYearLabel,
  getCalendarWeekdayLabels,
  resolveCalendarLocale,
  resolveCalendarWeekStartsOn,
  type CalendarWeekdayFormat,
} from './calendar-locale';
import { IconButton } from './icon-button';
import { HStack } from './stack';
import { Text } from './text';
import { useDirection } from './use-direction';

// Custom cross-platform month grid (ADR-008, "Native system picker vs. custom Calendar
// responsibilities"): one implementation for every platform and for every use
// (standalone and inside `DatePicker`'s future Web `Popover` presentation, #173). Web
// keyboard behavior follows the WAI-ARIA Date Picker Dialog grid pattern; RTL mirroring
// reuses React Native's own Yoga `direction` style on the root `View` (ADR-004,
// "Layout mirroring") rather than reimplementing row-reversal.

export type CalendarVisibleMonth = {
  month: number;
  year: number;
};

export type CalendarProps = Omit<ViewProps, 'children' | 'role'> & {
  /** Names the day grid for assistive tech. Defaults to the visible "Month Year" label. */
  accessibilityLabel?: string;
  className?: string;
  /** Initial visible month when `visibleMonth` is uncontrolled. Defaults to `value`'s month, else today's. */
  defaultVisibleMonth?: CalendarVisibleMonth;
  direction?: AnchoredOverlayDirection;
  disabled?: boolean;
  isDateDisabled?: (date: CalendarDate) => boolean;
  /** Explicit-only (ADR-008) — no ambient device/browser locale auto-detection. Defaults to `'en-US'`. */
  locale?: string;
  max?: CalendarDate;
  min?: CalendarDate;
  nextMonthAccessibilityLabel?: string;
  onValueChange?: (date: CalendarDate) => void;
  onVisibleMonthChange?: (visibleMonth: CalendarVisibleMonth) => void;
  previousMonthAccessibilityLabel?: string;
  /** Keeps the grid focusable/navigable but blocks selection, distinct from `disabled`. */
  readOnly?: boolean;
  /** Controlled selected date. Single-date selection only for 1.0 (ADR-008). */
  value: CalendarDate | null;
  visibleMonth?: CalendarVisibleMonth;
  weekdayFormat?: CalendarWeekdayFormat;
  weekStartsOn?: CalendarWeekStartsOn;
};

type CalendarWebKeyboardEvent = {
  key?: string;
  preventDefault?: () => void;
  shiftKey?: boolean;
};

function resolveInitialVisibleMonth(
  visibleMonthProp: CalendarVisibleMonth | undefined,
  hasVisibleMonthProp: boolean,
  defaultVisibleMonth: CalendarVisibleMonth | undefined,
  value: CalendarDate | null,
): CalendarVisibleMonth {
  if (hasVisibleMonthProp && visibleMonthProp) return visibleMonthProp;
  if (defaultVisibleMonth) return defaultVisibleMonth;
  if (value) return { month: value.month, year: value.year };
  const today = fromLocalDate(new Date());
  return { month: today.month, year: today.year };
}

function buildDayAccessibilityLabel(
  date: CalendarDate,
  locale: string,
  state: { disabled: boolean; isToday: boolean; selected: boolean },
): string {
  const parts = [getCalendarDayAccessibilityLabel(date, locale)];
  if (state.isToday) parts.push('Today');
  if (state.selected) parts.push('Selected');
  if (state.disabled) parts.push('Disabled');
  return parts.join(', ');
}

export const Calendar = React.forwardRef<React.ComponentRef<typeof View>, CalendarProps>(
  (props, forwardedRef) => {
    const hasVisibleMonthProp = Object.prototype.hasOwnProperty.call(props, 'visibleMonth');
    const {
      accessibilityLabel,
      className,
      defaultVisibleMonth,
      direction: directionProp,
      disabled = false,
      isDateDisabled,
      locale: localeProp,
      max,
      min,
      nextMonthAccessibilityLabel = 'Next month',
      onValueChange,
      onVisibleMonthChange,
      previousMonthAccessibilityLabel = 'Previous month',
      readOnly = false,
      style,
      testID,
      value,
      visibleMonth: visibleMonthProp,
      weekdayFormat = 'short',
      weekStartsOn: weekStartsOnProp,
      ...rest
    } = props;

    const direction = useDirection(directionProp);
    const locale = resolveCalendarLocale(localeProp);
    const weekStartsOn = resolveCalendarWeekStartsOn(weekStartsOnProp, localeProp);

    React.useEffect(() => {
      if (typeof __DEV__ === 'undefined' || !__DEV__) return;
      if (hasVisibleMonthProp && !onVisibleMonthChange) {
        console.warn(
          'BeeUI Calendar: `visibleMonth` requires `onVisibleMonthChange`. Falling back to internal navigation state.',
        );
      }
    }, [hasVisibleMonthProp, onVisibleMonthChange]);

    const visibleMonthControlled = hasVisibleMonthProp && onVisibleMonthChange !== undefined;

    const [internalVisibleMonth, setInternalVisibleMonth] = React.useState<CalendarVisibleMonth>(() =>
      resolveInitialVisibleMonth(visibleMonthProp, hasVisibleMonthProp, defaultVisibleMonth, value),
    );
    const resolvedVisibleMonth =
      visibleMonthControlled && visibleMonthProp ? visibleMonthProp : internalVisibleMonth;

    const setVisibleMonth = React.useCallback(
      (next: CalendarVisibleMonth) => {
        if (!visibleMonthControlled) setInternalVisibleMonth(next);
        onVisibleMonthChange?.(next);
      },
      [onVisibleMonthChange, visibleMonthControlled],
    );

    const [focusedDate, setFocusedDate] = React.useState<CalendarDate>(() => {
      if (value) return value;
      const initialMonth = resolveInitialVisibleMonth(
        visibleMonthProp,
        hasVisibleMonthProp,
        defaultVisibleMonth,
        value,
      );
      return clampCalendarDate({ day: 1, month: initialMonth.month, year: initialMonth.year }, min, max);
    });

    // Follows the controlled `value` when it changes (not on mount, so `defaultVisibleMonth`
    // stays honored even when a value is already selected in a different month at mount).
    const previousValueKeyRef = React.useRef<string | null>(value ? toISODateString(value) : null);
    React.useEffect(() => {
      const key = value ? toISODateString(value) : null;
      const changed = key !== previousValueKeyRef.current;
      previousValueKeyRef.current = key;
      if (!changed || !value) return;
      setFocusedDate(value);
      if (value.year !== resolvedVisibleMonth.year || value.month !== resolvedVisibleMonth.month) {
        setVisibleMonth({ month: value.month, year: value.year });
      }
      // `resolvedVisibleMonth`/`setVisibleMonth` intentionally excluded: this effect only
      // reacts to `value` changing, reading the latest visible month via closure.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value?.year, value?.month, value?.day]);

    const weeks = React.useMemo(
      () =>
        getCalendarMonthGrid({
          month: resolvedVisibleMonth.month,
          weekStartsOn,
          year: resolvedVisibleMonth.year,
        }),
      [resolvedVisibleMonth.month, resolvedVisibleMonth.year, weekStartsOn],
    );

    // Keeps the roving-tabindex target valid whenever the displayed grid changes out from
    // under `focusedDate` (a controlled `visibleMonth` navigated without a `value` change,
    // or a `defaultVisibleMonth` that did not match the initial `focusedDate`'s month).
    React.useEffect(() => {
      const inGrid = weeks.some((week) => week.some((cell) => isSameCalendarDate(cell.date, focusedDate)));
      if (inGrid) return;
      setFocusedDate(
        clampCalendarDate(
          { day: 1, month: resolvedVisibleMonth.month, year: resolvedVisibleMonth.year },
          min,
          max,
        ),
      );
    }, [focusedDate, max, min, resolvedVisibleMonth.month, resolvedVisibleMonth.year, weeks]);

    const today = React.useMemo(() => fromLocalDate(new Date()), []);
    const weekdayLabels = React.useMemo(
      () => getCalendarWeekdayLabels(weekStartsOn, locale, weekdayFormat),
      [locale, weekStartsOn, weekdayFormat],
    );
    const monthYearLabel = React.useMemo(
      () =>
        getCalendarMonthYearLabel(
          { day: 1, month: resolvedVisibleMonth.month, year: resolvedVisibleMonth.year },
          locale,
        ),
      [locale, resolvedVisibleMonth.month, resolvedVisibleMonth.year],
    );

    const cellRefs = React.useRef(new Map<string, React.ComponentRef<typeof Pressable>>());
    const gridHasFocusRef = React.useRef(false);

    React.useEffect(() => {
      if (Platform.OS !== 'web' || disabled || !gridHasFocusRef.current) return;
      cellRefs.current.get(toISODateString(focusedDate))?.focus?.();
    }, [disabled, focusedDate]);

    const isCellDisabled = React.useCallback(
      (date: CalendarDate) => disabled || isCalendarDateDisabled(date, { isDateDisabled, max, min }),
      [disabled, isDateDisabled, max, min],
    );

    const moveFocus = React.useCallback(
      (next: CalendarDate) => {
        setFocusedDate(next);
        if (next.year !== resolvedVisibleMonth.year || next.month !== resolvedVisibleMonth.month) {
          setVisibleMonth({ month: next.month, year: next.year });
        }
      },
      [resolvedVisibleMonth.month, resolvedVisibleMonth.year, setVisibleMonth],
    );

    const goToAdjacentMonth = React.useCallback(
      (amount: number) => moveFocus(addCalendarMonths(focusedDate, amount)),
      [focusedDate, moveFocus],
    );

    const commitSelection = React.useCallback(
      (date: CalendarDate) => {
        if (readOnly || isCellDisabled(date)) return;
        onValueChange?.(date);
      },
      [isCellDisabled, onValueChange, readOnly],
    );

    const currentWeek = React.useMemo(
      () => weeks.find((week) => week.some((cell) => isSameCalendarDate(cell.date, focusedDate))) ?? weeks[0],
      [focusedDate, weeks],
    );

    const handleWebKeyDown = React.useCallback(
      (event: CalendarWebKeyboardEvent) => {
        if (disabled) return;
        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault?.();
            moveFocus(addCalendarDays(focusedDate, direction === 'rtl' ? -1 : 1));
            break;
          case 'ArrowLeft':
            event.preventDefault?.();
            moveFocus(addCalendarDays(focusedDate, direction === 'rtl' ? 1 : -1));
            break;
          case 'ArrowDown':
            event.preventDefault?.();
            moveFocus(addCalendarDays(focusedDate, 7));
            break;
          case 'ArrowUp':
            event.preventDefault?.();
            moveFocus(addCalendarDays(focusedDate, -7));
            break;
          case 'PageDown':
            event.preventDefault?.();
            moveFocus(
              event.shiftKey ? addCalendarYears(focusedDate, 1) : addCalendarMonths(focusedDate, 1),
            );
            break;
          case 'PageUp':
            event.preventDefault?.();
            moveFocus(
              event.shiftKey ? addCalendarYears(focusedDate, -1) : addCalendarMonths(focusedDate, -1),
            );
            break;
          case 'Home':
            event.preventDefault?.();
            if (currentWeek) moveFocus(currentWeek[0].date);
            break;
          case 'End':
            event.preventDefault?.();
            if (currentWeek) moveFocus(currentWeek[6].date);
            break;
          case 'Enter':
          case ' ':
            event.preventDefault?.();
            commitSelection(focusedDate);
            break;
          default:
            break;
        }
      },
      [commitSelection, currentWeek, direction, disabled, focusedDate, moveFocus],
    );

    const webKeyboardProps =
      Platform.OS === 'web'
        ? ({ onKeyDown: handleWebKeyDown } as unknown as ViewProps)
        : ({} as ViewProps);

    return (
      <View
        ref={forwardedRef}
        {...rest}
        className={cn('gap-3', className)}
        style={[{ direction }, style]}
        testID={testID}
      >
        <HStack align="center" gap="sm" justify="between">
          <IconButton
            accessibilityLabel={previousMonthAccessibilityLabel}
            disabled={disabled}
            onPress={() => goToAdjacentMonth(-1)}
            testID={testID ? `${testID}-previous-month` : undefined}
            variant="ghost"
          >
            <Text aria-hidden className="text-foreground" variant="body">
              {direction === 'rtl' ? '›' : '‹'}
            </Text>
          </IconButton>
          <Text accessibilityLiveRegion="polite" testID={testID ? `${testID}-month-label` : undefined} variant="label">
            {monthYearLabel}
          </Text>
          <IconButton
            accessibilityLabel={nextMonthAccessibilityLabel}
            disabled={disabled}
            onPress={() => goToAdjacentMonth(1)}
            testID={testID ? `${testID}-next-month` : undefined}
            variant="ghost"
          >
            <Text aria-hidden className="text-foreground" variant="body">
              {direction === 'rtl' ? '‹' : '›'}
            </Text>
          </IconButton>
        </HStack>
        <View
          accessibilityElementsHidden
          aria-hidden
          className="flex-row"
          importantForAccessibility="no-hide-descendants"
        >
          {weekdayLabels.map((label, index) => (
            <View key={`calendar-weekday-${index}`} className="flex-1 items-center py-1">
              <Text tone="muted" variant="caption">
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View
          {...webKeyboardProps}
          accessibilityLabel={accessibilityLabel ?? monthYearLabel}
          className="gap-1"
          role="grid"
          testID={testID ? `${testID}-grid` : undefined}
        >
          {weeks.map((week, weekIndex) => (
            <View key={`calendar-week-${weekIndex}`} className="flex-row" role="row">
              {week.map((cell) => {
                const iso = toISODateString(cell.date);
                const selected = value ? isSameCalendarDate(cell.date, value) : false;
                const isToday = isSameCalendarDate(cell.date, today);
                const cellDisabled = isCellDisabled(cell.date);
                const isRovingTarget = isSameCalendarDate(cell.date, focusedDate);

                return (
                  <Pressable
                    key={iso}
                    ref={(node) => {
                      if (node) cellRefs.current.set(iso, node);
                      else cellRefs.current.delete(iso);
                    }}
                    accessibilityLabel={buildDayAccessibilityLabel(cell.date, locale, {
                      disabled: cellDisabled,
                      isToday,
                      selected,
                    })}
                    accessibilityState={{ disabled: cellDisabled, selected }}
                    className={cn(
                      'min-h-touch-target min-w-touch-target flex-1 items-center justify-center rounded-md web:focus-visible:bee-focus-ring',
                      selected && 'bg-primary',
                      !selected && isToday && 'border border-primary',
                    )}
                    disabled={cellDisabled}
                    onBlur={() => {
                      gridHasFocusRef.current = false;
                    }}
                    onFocus={() => {
                      gridHasFocusRef.current = true;
                    }}
                    onPress={() => {
                      moveFocus(cell.date);
                      commitSelection(cell.date);
                    }}
                    role="cell"
                    tabIndex={!disabled && isRovingTarget ? 0 : -1}
                    testID={testID ? `${testID}-day-${iso}` : undefined}
                  >
                    <Text
                      className={cn(
                        selected && 'text-primary-foreground',
                        !selected && cellDisabled && 'text-disabled-foreground',
                        !selected && !cellDisabled && !cell.isCurrentMonth && 'text-muted-foreground',
                      )}
                      variant="body"
                    >
                      {cell.date.day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    );
  },
);

Calendar.displayName = 'Calendar';
