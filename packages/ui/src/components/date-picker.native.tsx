import { cn, fromLocalDate, toLocalDate, type CalendarDate } from '@beeui/core';
import * as React from 'react';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Platform, Pressable, View } from 'react-native';
import { Button } from './button';
import { resolveCalendarLocale } from './calendar-locale';
import {
  DATE_PICKER_DEFAULT_CLEAR_ACCESSIBILITY_LABEL,
  DATE_PICKER_DEFAULT_PLACEHOLDER,
  useDatePickerFieldIntegration,
  useDatePickerOpenState,
  type DatePickerProps,
} from './date-picker-shared';
import { getDatePickerFormattedValue } from './date-picker-locale';
import { Dialog, DialogContent, DialogFooter } from './dialog';
import { IconButton } from './icon-button';
import { Text } from './text';

export * from './date-picker-shared';

// Native presentation (ADR-008, Decision "Native system picker vs. custom Calendar
// responsibilities" + Option C2): delegates actual date selection to the platform's
// native system picker (`@react-native-community/datetimepicker`), never BeeUI's own
// `Calendar` grid. This file is the *only* place that package is imported — Metro's
// platform-extension resolution (`.native.tsx` wins over `.ts`/`.tsx` on iOS/Android)
// keeps it out of the Web bundle entirely.
//
// Android renders no persistent component at all: `DateTimePickerAndroid.open()` is the
// community-recommended imperative API (avoids the double-dialog re-render footgun a
// mounted `<DateTimePicker>` has on Android) and the OS dialog already supplies its own
// OK/Cancel chrome, so it needs no BeeUI-owned wrapper.
// iOS has no such imperative API — its inline/compact display modes are a bare widget
// with no chrome of their own, so this wraps it in BeeUI's existing `Dialog` (Android
// Back/dismiss handling, focus, portal already solved there) rather than introducing a
// second modal authority.
//
// Known 1.0 limitation (owed to native acceptance, #176/#177): the native system picker
// has no per-day disabled-predicate API, so `isDateDisabled` is honored on Web only.
// `min`/`max` map to `minimumDate`/`maximumDate` on both platforms.

function toNativeDate(date: CalendarDate | null): Date {
  return date ? toLocalDate(date) : new Date();
}

export const DatePicker = React.forwardRef<React.ComponentRef<typeof Pressable>, DatePickerProps>(
  (props, forwardedRef) => {
    const hasOpenProp = Object.prototype.hasOwnProperty.call(props, 'open');
    const {
      accessibilityLabel,
      className,
      clearAccessibilityLabel = DATE_PICKER_DEFAULT_CLEAR_ACCESSIBILITY_LABEL,
      clearable = true,
      defaultOpen,
      disabled: disabledProp,
      formatValue,
      invalid: invalidProp,
      locale: localeProp,
      max,
      min,
      onOpenChange,
      onValueChange,
      open,
      placeholder = DATE_PICKER_DEFAULT_PLACEHOLDER,
      readOnly = false,
      style,
      testID,
      value,
    } = props;

    const field = useDatePickerFieldIntegration({
      accessibilityLabel,
      disabled: disabledProp,
      invalid: invalidProp,
    });
    const { open: resolvedOpen, setOpen } = useDatePickerOpenState({
      defaultOpen,
      hasOpenProp,
      onOpenChange,
      open,
    });
    const locale = resolveCalendarLocale(localeProp);
    const minimumDate = min ? toLocalDate(min) : undefined;
    const maximumDate = max ? toLocalDate(max) : undefined;

    const formattedValue = value
      ? (formatValue ?? getDatePickerFormattedValue)(value, locale)
      : undefined;
    const hasValue = formattedValue !== undefined;
    const showClear = clearable && hasValue && !field.disabled && !readOnly;

    const handleAndroidChange = React.useCallback(
      (event: DateTimePickerEvent, selectedDate?: Date) => {
        setOpen(false);
        if (event.type === 'set' && selectedDate) onValueChange?.(fromLocalDate(selectedDate));
      },
      [onValueChange, setOpen],
    );

    const openAndroidPicker = React.useCallback(() => {
      DateTimePickerAndroid.open({
        maximumDate,
        minimumDate,
        mode: 'date',
        onChange: handleAndroidChange,
        value: toNativeDate(value),
      });
    }, [handleAndroidChange, maximumDate, minimumDate, value]);

    const handleIOSChange = React.useCallback(
      (_event: DateTimePickerEvent, selectedDate?: Date) => {
        if (selectedDate) onValueChange?.(fromLocalDate(selectedDate));
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
            'min-h-11 min-w-48 flex-row items-center rounded-md border border-border-strong bg-input',
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
              <DateTimePicker
                accessibilityLabel={field.accessibilityLabel ?? placeholder}
                display="inline"
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                mode="date"
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
  },
);

DatePicker.displayName = 'DatePicker';
