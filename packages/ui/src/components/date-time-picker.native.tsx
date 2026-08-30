import { clockTimeFromLocalDate, cn, fromLocalDate, toLocalDate } from '@beeui/core';
import * as React from 'react';
import NativeDateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Platform, Pressable, View } from 'react-native';
import { Button } from './button';
import { resolveCalendarLocale } from './calendar-locale';
import {
  DATE_TIME_PICKER_DEFAULT_CLEAR_ACCESSIBILITY_LABEL,
  DATE_TIME_PICKER_DEFAULT_PLACEHOLDER,
  useDateTimePickerFieldIntegration,
  useDateTimePickerOpenState,
  type DateTimePickerProps,
  type DateTimePickerValue,
} from './date-time-picker-shared';
import { getDateTimePickerFormattedValue, resolveDateTimePickerHour12 } from './date-time-picker-locale';
import { Dialog, DialogContent, DialogFooter } from './dialog';
import { IconButton } from './icon-button';
import { Text } from './text';

export * from './date-time-picker-shared';

// Native presentation (ADR-008, Decision "Native system picker vs. custom Calendar
// responsibilities" + Implementation consequences for #174): delegates actual
// date+time selection to `@react-native-community/datetimepicker`, the same
// dependency `DatePicker` already depends on (no new peer/dev dependency for this
// component — see `docs/compatibility-matrix.md`'s existing row and
// `scripts/verify-bare-consumer.sh`'s existing pin).
//
// iOS supports a single native `mode="datetime"` widget (calendar + inline time), so it
// is wrapped in BeeUI's `Dialog` exactly like `DatePicker.native.tsx`'s iOS branch:
// changes apply immediately via `onChange`, a "Done" button only closes.
//
// Android's native picker has **no `"datetime"` mode** — `DateTimePickerAndroid.open()`
// only supports `mode: 'date' | 'time' | 'countdown'` (community-documented, not a
// BeeUI choice). This is an explicit, documented, platform-honest divergence
// (`docs/agent-execution-contract.md`'s "Web/iOS/Android behavior may differ ... but
// public contracts must remain coherent"): Android opens the date step first, then
// chains into the time step on "set", combining both into one
// `{ date, time }` commit. Dismissing either step cancels the whole flow without
// committing a partial value.
//
// Known 1.0 limitation (owed to native acceptance, #176/#177): the native system
// picker has no per-day disabled-predicate API, so `isDateDisabled` is honored on Web
// only. `min`/`max` map to `minimumDate`/`maximumDate` (date bounds only) on both
// platforms. `hour12` maps to Android's `is24Hour`; iOS derives its own 12/24h display
// from the device locale and does not accept a BeeUI override (community-documented
// iOS platform limitation).

function toNativeDate(value: DateTimePickerValue | null): Date {
  return value ? toLocalDate(value.date, value.time) : new Date();
}

function toValue(date: Date): DateTimePickerValue {
  return { date: fromLocalDate(date), time: clockTimeFromLocalDate(date) };
}

export const DateTimePicker = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  DateTimePickerProps
>((props, forwardedRef) => {
  const hasOpenProp = Object.prototype.hasOwnProperty.call(props, 'open');
  const {
    accessibilityLabel,
    className,
    clearAccessibilityLabel = DATE_TIME_PICKER_DEFAULT_CLEAR_ACCESSIBILITY_LABEL,
    clearable = true,
    defaultOpen,
    disabled: disabledProp,
    formatValue,
    hour12: hour12Prop,
    invalid: invalidProp,
    locale: localeProp,
    max,
    min,
    onOpenChange,
    onValueChange,
    open,
    placeholder = DATE_TIME_PICKER_DEFAULT_PLACEHOLDER,
    readOnly = false,
    style,
    testID,
    value,
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
  const minimumDate = min ? toLocalDate(min) : undefined;
  const maximumDate = max ? toLocalDate(max) : undefined;

  const formattedValue = value
    ? (formatValue ?? getDateTimePickerFormattedValue)(value, locale)
    : undefined;
  const hasValue = formattedValue !== undefined;
  const showClear = clearable && hasValue && !field.disabled && !readOnly;

  const openAndroidTimeStep = React.useCallback(
    (initialDateTime: Date) => {
      DateTimePickerAndroid.open({
        is24Hour: !hour12,
        mode: 'time',
        onChange: (event: DateTimePickerEvent, selectedDateTime?: Date) => {
          setOpen(false);
          if (event.type === 'set' && selectedDateTime) onValueChange?.(toValue(selectedDateTime));
        },
        value: initialDateTime,
      });
    },
    [hour12, onValueChange, setOpen],
  );

  const openAndroidPicker = React.useCallback(() => {
    DateTimePickerAndroid.open({
      maximumDate,
      minimumDate,
      mode: 'date',
      onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (event.type === 'set' && selectedDate) {
          openAndroidTimeStep(selectedDate);
          return;
        }
        setOpen(false);
      },
      value: toNativeDate(value),
    });
  }, [maximumDate, minimumDate, openAndroidTimeStep, setOpen, value]);

  const handleIOSChange = React.useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (selectedDate) onValueChange?.(toValue(selectedDate));
    },
    [onValueChange],
  );

  const handlePress = React.useCallback(() => {
    if (field.disabled || readOnly) return;
    if (Platform.OS === 'android') {
      openAndroidPicker();
      return;
    }
    setOpen(true);
  }, [field.disabled, openAndroidPicker, readOnly, setOpen]);

  const handleClear = React.useCallback(() => {
    onValueChange?.(null);
  }, [onValueChange]);

  return (
    <>
      <View
        className={cn(
          'min-h-11 min-w-56 flex-row items-center rounded-md border border-border-strong bg-input',
          field.disabled && 'border-disabled bg-disabled opacity-60',
          className,
        )}
        style={style}
        testID={testID}
      >
        <Pressable
          ref={forwardedRef}
          accessibilityHint={field.accessibilityHint}
          accessibilityLabel={field.accessibilityLabel}
          accessibilityLabelledBy={field.accessibilityLabelledBy}
          accessibilityRole="button"
          accessibilityState={{ disabled: field.disabled }}
          className="min-h-11 flex-1 flex-row items-center justify-start px-3"
          disabled={field.disabled}
          onPress={handlePress}
          testID={testID ? `${testID}-trigger` : undefined}
        >
          <Text
            className={hasValue ? 'text-foreground' : 'text-muted-foreground'}
            testID={testID ? `${testID}-value` : undefined}
            variant="body"
          >
            {hasValue ? formattedValue : placeholder}
          </Text>
        </Pressable>
        {showClear ? (
          <IconButton
            accessibilityLabel={clearAccessibilityLabel}
            className="mr-1"
            onPress={handleClear}
            testID={testID ? `${testID}-clear` : undefined}
            variant="ghost"
          >
            <Text aria-hidden className="text-muted-foreground" variant="body">
              ×
            </Text>
          </IconButton>
        ) : (
          <Text aria-hidden className="pr-3 text-muted-foreground" variant="body">
            ⌄
          </Text>
        )}
      </View>
      {Platform.OS === 'ios' ? (
        <Dialog onOpenChange={setOpen} open={resolvedOpen}>
          <DialogContent
            accessibilityLabel={field.accessibilityLabel ?? placeholder}
            testID={testID ? `${testID}-content` : undefined}
          >
            <NativeDateTimePicker
              accessibilityLabel={field.accessibilityLabel ?? placeholder}
              display="inline"
              locale={localeProp}
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              mode="datetime"
              onChange={handleIOSChange}
              value={toNativeDate(value)}
            />
            <DialogFooter>
              {clearable && value ? (
                <Button
                  onPress={() => {
                    onValueChange?.(null);
                    setOpen(false);
                  }}
                  testID={testID ? `${testID}-content-clear` : undefined}
                  variant="ghost"
                >
                  {clearAccessibilityLabel}
                </Button>
              ) : null}
              <Button
                onPress={() => setOpen(false)}
                testID={testID ? `${testID}-content-done` : undefined}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
});

DateTimePicker.displayName = 'DateTimePicker';
