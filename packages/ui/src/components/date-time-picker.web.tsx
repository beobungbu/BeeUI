import { cn, fromLocalDate, type CalendarDate, type ClockTime } from '@beeui/core';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Button } from './button';
import { Calendar } from './calendar';
import { resolveCalendarLocale } from './calendar-locale';
import {
  DATE_TIME_PICKER_DEFAULT_CLEAR_ACCESSIBILITY_LABEL,
  DATE_TIME_PICKER_DEFAULT_HOUR_ACCESSIBILITY_LABEL,
  DATE_TIME_PICKER_DEFAULT_MINUTE_ACCESSIBILITY_LABEL,
  DATE_TIME_PICKER_DEFAULT_PERIOD_ACCESSIBILITY_LABEL,
  DATE_TIME_PICKER_DEFAULT_PLACEHOLDER,
  useDateTimePickerFieldIntegration,
  useDateTimePickerOpenState,
  type DateTimePickerProps,
  type DateTimePickerValue,
} from './date-time-picker-shared';
import {
  fromDisplayHour,
  getDateTimePickerFormattedValue,
  getDateTimePickerPeriodLabels,
  resolveDateTimePickerHour12,
  toDisplayHour,
  type DateTimePickerPeriod,
} from './date-time-picker-locale';
import { IconButton } from './icon-button';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { SegmentedControl, SegmentedControlItem } from './segmented-control';
import { HStack } from './stack';
import { Text } from './text';

export * from './date-time-picker-shared';

// Web presentation (ADR-008, Decision "Web presentation" + Implementation
// consequences for #174): the trigger opens BeeUI's own `Calendar` (the date part,
// exactly as `DatePicker` does) plus a minimal Web time control built from `Input`
// digit-entry (hour/minute) and `SegmentedControl` (AM/PM, only when the resolved
// locale is 12h) inside the same `Popover` — one surface for the whole
// `{ date, time }` value, not two separate overlays. Unlike `DatePicker`, selecting a
// day does not close the popover (there is still a time part to set); an explicit
// "Done" button closes it, mirroring `DatePicker.native.tsx`'s iOS Dialog footer
// pattern where changes apply immediately and Done only dismisses.

const DEFAULT_TIME: ClockTime = { hour: 0, minute: 0 };

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

function clampDigits(raw: string, min: number, max: number): number {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return min;
  return Math.min(max, Math.max(min, Number.parseInt(digits, 10)));
}

type TimeDigitInputProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  max: number;
  min: number;
  onValueChange: (next: number) => void;
  testID?: string;
  value: number;
};

// A minimal two-digit numeric field (ADR-008's "Input digit-entry for hour/minute", no
// bespoke time-wheel component). Buffers raw keystrokes locally so typing "1" then "5"
// for "15" is not clobbered by an intermediate clamp/pad; clamping and zero-padding
// happen on blur/submit, not on every keystroke.
function TimeDigitInput({
  accessibilityLabel,
  disabled,
  invalid,
  max,
  min,
  onValueChange,
  testID,
  value,
}: TimeDigitInputProps) {
  const [text, setText] = React.useState(() => String(value).padStart(2, '0'));
  const focusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusedRef.current) setText(String(value).padStart(2, '0'));
  }, [value]);

  const commit = React.useCallback(() => {
    setText((current) => {
      const parsed = clampDigits(current, min, max);
      if (parsed !== value) onValueChange(parsed);
      return String(parsed).padStart(2, '0');
    });
  }, [max, min, onValueChange, value]);

  return (
    <Input
      accessibilityLabel={accessibilityLabel}
      className="w-14 text-center"
      disabled={disabled}
      editable={!disabled}
      inputMode="numeric"
      invalid={invalid}
      keyboardType="number-pad"
      maxLength={2}
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onChangeText={(next) => setText(next.replace(/\D/g, '').slice(0, 2))}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onSubmitEditing={commit}
      returnKeyType="done"
      testID={testID}
      value={text}
    />
  );
}

type DateTimePickerTimeFieldProps = {
  disabled?: boolean;
  hour12: boolean;
  hourAccessibilityLabel: string;
  invalid?: boolean;
  minuteAccessibilityLabel: string;
  onTimeChange: (time: ClockTime) => void;
  periodAccessibilityLabel: string;
  periodLabels: { am: string; pm: string };
  testID?: string;
  time: ClockTime;
};

function DateTimePickerTimeField({
  disabled,
  hour12,
  hourAccessibilityLabel,
  invalid,
  minuteAccessibilityLabel,
  onTimeChange,
  periodAccessibilityLabel,
  periodLabels,
  testID,
  time,
}: DateTimePickerTimeFieldProps) {
  const { displayHour, period } = toDisplayHour(time.hour);

  return (
    <HStack align="center" gap="sm">
      <TimeDigitInput
        accessibilityLabel={hourAccessibilityLabel}
        disabled={disabled}
        invalid={invalid}
        max={hour12 ? 12 : 23}
        min={hour12 ? 1 : 0}
        onValueChange={(nextDisplayHour) => {
          const hour = hour12 ? fromDisplayHour(nextDisplayHour, period) : nextDisplayHour;
          onTimeChange({ hour, minute: time.minute });
        }}
        testID={testID ? `${testID}-hour` : undefined}
        value={hour12 ? displayHour : time.hour}
      />
      <Text aria-hidden variant="body">
        :
      </Text>
      <TimeDigitInput
        accessibilityLabel={minuteAccessibilityLabel}
        disabled={disabled}
        invalid={invalid}
        max={59}
        min={0}
        onValueChange={(minute) => onTimeChange({ hour: time.hour, minute })}
        testID={testID ? `${testID}-minute` : undefined}
        value={time.minute}
      />
      {hour12 ? (
        <SegmentedControl
          accessibilityLabel={periodAccessibilityLabel}
          disabled={disabled}
          onValueChange={(nextPeriod) => {
            const hour = fromDisplayHour(displayHour, nextPeriod as DateTimePickerPeriod);
            onTimeChange({ hour, minute: time.minute });
          }}
          testID={testID ? `${testID}-period` : undefined}
          value={period}
        >
          <SegmentedControlItem testID={testID ? `${testID}-period-am` : undefined} value="AM">
            {periodLabels.am}
          </SegmentedControlItem>
          <SegmentedControlItem testID={testID ? `${testID}-period-pm` : undefined} value="PM">
            {periodLabels.pm}
          </SegmentedControlItem>
        </SegmentedControl>
      ) : null}
    </HStack>
  );
}

export const DateTimePicker = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  DateTimePickerProps
>((props, forwardedRef) => {
  const hasOpenProp = Object.prototype.hasOwnProperty.call(props, 'open');
  const {
    accessibilityLabel,
    align = 'start',
    className,
    clearAccessibilityLabel = DATE_TIME_PICKER_DEFAULT_CLEAR_ACCESSIBILITY_LABEL,
    clearable = true,
    closeOnOutsidePress = true,
    collisionPadding,
    defaultOpen,
    direction,
    disabled: disabledProp,
    flip,
    formatValue,
    hour12: hour12Prop,
    hourAccessibilityLabel = DATE_TIME_PICKER_DEFAULT_HOUR_ACCESSIBILITY_LABEL,
    invalid: invalidProp,
    isDateDisabled,
    locale: localeProp,
    max,
    min,
    minuteAccessibilityLabel = DATE_TIME_PICKER_DEFAULT_MINUTE_ACCESSIBILITY_LABEL,
    nextMonthAccessibilityLabel,
    onOpenChange,
    onValueChange,
    open,
    periodAccessibilityLabel = DATE_TIME_PICKER_DEFAULT_PERIOD_ACCESSIBILITY_LABEL,
    placeholder = DATE_TIME_PICKER_DEFAULT_PLACEHOLDER,
    placement = 'bottom',
    previousMonthAccessibilityLabel,
    readOnly = false,
    shift,
    sideOffset,
    style,
    testID,
    value,
    weekStartsOn: weekStartsOnProp,
  } = props;

  const field = useDateTimePickerFieldIntegration({
    accessibilityLabel,
    disabled: disabledProp,
    invalid: invalidProp,
  });
  const { open: resolvedOpen, setOpen } = useDateTimePickerOpenState({
    defaultOpen,
    hasOpenProp,
    onOpenChange,
    open,
  });
  const locale = resolveCalendarLocale(localeProp);
  const hour12 = resolveDateTimePickerHour12(hour12Prop, locale);
  const periodLabels = React.useMemo(() => getDateTimePickerPeriodLabels(locale), [locale]);

  const anchorRef = React.useRef<React.ComponentRef<typeof Pressable> | null>(null);
  const setTriggerRef = React.useCallback(
    (node: React.ComponentRef<typeof Pressable> | null) => {
      anchorRef.current = node;
      assignRef(forwardedRef, node);
    },
    [forwardedRef],
  );
  const calendarRef = React.useRef<React.ComponentRef<typeof Calendar> | null>(null);

  const effectiveOpen = readOnly ? false : resolvedOpen;
  const handlePopoverOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (readOnly && nextOpen) return;
      setOpen(nextOpen);
    },
    [readOnly, setOpen],
  );

  // Focus restoration to the trigger on close (ADR-008), the exact pattern
  // `DatePicker.web.tsx` uses.
  const previousOpenRef = React.useRef(effectiveOpen);
  React.useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = effectiveOpen;
    if (wasOpen && !effectiveOpen) anchorRef.current?.focus?.();
  }, [effectiveOpen]);

  // Moves focus into the Calendar's roving-tabindex target when the popover opens
  // (WAI-ARIA Date Picker Dialog pattern) — the exact pattern `DatePicker.web.tsx`
  // uses (see that file's own comment for the full "why" of the bounded
  // retry-across-animation-frames approach and the `[role="cell"]` scoping).
  React.useEffect(() => {
    if (!effectiveOpen) return;
    let frame = 0;
    let cancelled = false;
    const tryFocus = (attemptsLeft: number) => {
      if (cancelled) return;
      const target = (
        calendarRef.current as unknown as
          | { querySelector?: (selector: string) => { focus?: () => void } | null }
          | null
      )?.querySelector?.('[role="cell"][tabindex="0"]');
      target?.focus?.();
      const globalDocument = (globalThis as { document?: { activeElement?: unknown } }).document;
      const focused = globalDocument !== undefined && globalDocument.activeElement === target;
      if (focused || attemptsLeft <= 0) return;
      frame = requestAnimationFrame(() => tryFocus(attemptsLeft - 1));
    };
    frame = requestAnimationFrame(() => tryFocus(40));
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [effectiveOpen]);

  const formattedValue = value
    ? (formatValue ?? getDateTimePickerFormattedValue)(value, locale)
    : undefined;
  const hasValue = formattedValue !== undefined;
  const showClear = clearable && hasValue && !field.disabled && !readOnly;

  // Selecting a day does not close the popover — there is still a time part to set.
  // A default `time`/`date` fills the not-yet-chosen half so the value is always a
  // complete `{ date, time }` object (ADR-008's "one coherent controlled value model"),
  // never a partial date-only or time-only shape.
  const handleDateChange = React.useCallback(
    (date: CalendarDate) => {
      onValueChange?.({ date, time: value?.time ?? DEFAULT_TIME });
    },
    [onValueChange, value?.time],
  );

  const handleTimeChange = React.useCallback(
    (time: ClockTime) => {
      const date = value?.date ?? fromLocalDate(new Date());
      onValueChange?.({ date, time });
    },
    [onValueChange, value?.date],
  );

  const handleClear = React.useCallback(() => {
    onValueChange?.(null);
  }, [onValueChange]);

  const handleDone = React.useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const calendarValue: CalendarDate | null = value?.date ?? null;
  const timeValue: ClockTime = value?.time ?? DEFAULT_TIME;

  return (
    <Popover onOpenChange={handlePopoverOpenChange} open={effectiveOpen}>
      <View
        className={cn(
          'min-h-11 min-w-56 flex-row items-center rounded-md border border-border-strong bg-input',
          field.disabled && 'border-disabled bg-disabled opacity-60',
          className,
        )}
        style={style}
        testID={testID}
      >
        <PopoverTrigger
          ref={setTriggerRef}
          aria-expanded={effectiveOpen}
          accessibilityHint={field.accessibilityHint}
          accessibilityLabel={field.accessibilityLabel}
          accessibilityLabelledBy={field.accessibilityLabelledBy}
          accessibilityState={{ disabled: field.disabled }}
          className="min-h-11 flex-1 flex-row items-center justify-start rounded-md border-transparent bg-transparent px-3 web:hover:bg-surface-muted"
          disabled={field.disabled}
          testID={testID ? `${testID}-trigger` : undefined}
          variant="ghost"
        >
          <Text
            className={hasValue ? 'text-foreground' : 'text-muted-foreground'}
            testID={testID ? `${testID}-value` : undefined}
            variant="body"
          >
            {hasValue ? formattedValue : placeholder}
          </Text>
        </PopoverTrigger>
        {showClear ? (
          <IconButton
            accessibilityLabel={clearAccessibilityLabel}
            className="me-1"
            onPress={handleClear}
            testID={testID ? `${testID}-clear` : undefined}
            variant="ghost"
          >
            <Text aria-hidden className="text-muted-foreground" variant="body">
              ×
            </Text>
          </IconButton>
        ) : (
          // `pe-3` lives on this wrapping `View`, not the `Text` itself —
          // see the identical comment in `date-picker.web.tsx` (#142's
          // real-Chromium RTL stress matrix): react-native-web's `Text`
          // renders `dir="auto"`, which lets the browser resolve this one
          // node's own direction from its (directionless glyph) content
          // instead of inheriting the ambient direction, defeating
          // `padding-inline-end`. `View` has no such attribute.
          <View className="pe-3">
            <Text aria-hidden className="text-muted-foreground" variant="body">
              {effectiveOpen ? '⌃' : '⌄'}
            </Text>
          </View>
        )}
      </View>
      <PopoverContent
        align={align}
        avoidKeyboard={false}
        className="gap-3 p-3"
        closeOnOutsidePress={closeOnOutsidePress}
        collisionPadding={collisionPadding}
        direction={direction}
        flip={flip}
        placement={placement}
        shift={shift}
        sideOffset={sideOffset}
        testID={testID ? `${testID}-content` : undefined}
      >
        <Calendar
          ref={calendarRef}
          accessibilityLabel={accessibilityLabel}
          direction={direction}
          disabled={field.disabled}
          isDateDisabled={isDateDisabled}
          locale={localeProp}
          max={max}
          min={min}
          nextMonthAccessibilityLabel={nextMonthAccessibilityLabel}
          onValueChange={handleDateChange}
          previousMonthAccessibilityLabel={previousMonthAccessibilityLabel}
          readOnly={readOnly}
          testID={testID ? `${testID}-calendar` : undefined}
          value={calendarValue}
          weekStartsOn={weekStartsOnProp}
        />
        <DateTimePickerTimeField
          disabled={field.disabled}
          hour12={hour12}
          hourAccessibilityLabel={hourAccessibilityLabel}
          invalid={field.invalid}
          minuteAccessibilityLabel={minuteAccessibilityLabel}
          onTimeChange={handleTimeChange}
          periodAccessibilityLabel={periodAccessibilityLabel}
          periodLabels={periodLabels}
          testID={testID ? `${testID}-time` : undefined}
          time={timeValue}
        />
        <HStack justify="end">
          <Button
            disabled={field.disabled || readOnly}
            onPress={handleDone}
            testID={testID ? `${testID}-content-done` : undefined}
          >
            Done
          </Button>
        </HStack>
      </PopoverContent>
    </Popover>
  );
});

DateTimePicker.displayName = 'DateTimePicker';
