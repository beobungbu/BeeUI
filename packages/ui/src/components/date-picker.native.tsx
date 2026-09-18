import { cn, fromLocalDate, toLocalDate, type CalendarDate } from '@beemvp/beeui-core';
import * as React from 'react';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { Platform, Pressable, View } from 'react-native';
import { Button } from './button';
import { resolveCalendarLocale } from './calendar-locale';
import {
  DATE_PICKER_DEFAULT_CLEAR_ACCESSIBILITY_LABEL,
  useDatePickerFieldIntegration,
  useDatePickerOpenState,
  type DatePickerProps,
} from './date-picker-shared';
import { getDatePickerDefaultPlaceholder, getDatePickerFormattedValue } from './date-picker-locale';
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
      placeholder,
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
    const resolvedPlaceholder = placeholder ?? getDatePickerDefaultPlaceholder(locale);
    const minimumDate = min ? toLocalDate(min) : undefined;
    const maximumDate = max ? toLocalDate(max) : undefined;

    const formattedValue = value
      ? (formatValue ?? getDatePickerFormattedValue)(value, locale)
      : undefined;
    const hasValue = formattedValue !== undefined;
    const showClear = clearable && hasValue && !field.disabled && !readOnly;

    // `onValueChange`/`onDismiss` (not the deprecated `onChange`) — passing
    // `onChange` to either the imperative Android API or the iOS component
    // trips `@react-native-community/datetimepicker`'s own dev-mode
    // deprecation warning (`warnIfOnChangeIsUsed`, verified against 9.1's
    // source) even though the picker still works. `onValueChange` only fires
    // for an actual selection (`date: Date`, never `undefined`), so there is
    // no `event.type === 'set'` check to make anymore; a plain dismiss
    // (Android back/outside-tap, or the iOS Dialog's own close paths) is
    // handled by `onDismiss`/`setOpen(false)` instead.
    const handleAndroidValueChange = React.useCallback(
      (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
        setOpen(false);
        onValueChange?.(fromLocalDate(selectedDate));
      },
      [onValueChange, setOpen],
    );

    const handleAndroidDismiss = React.useCallback(() => {
      setOpen(false);
    }, [setOpen]);

    const openAndroidPicker = React.useCallback(() => {
      DateTimePickerAndroid.open({
        maximumDate,
        minimumDate,
        mode: 'date',
        onDismiss: handleAndroidDismiss,
        onValueChange: handleAndroidValueChange,
        value: toNativeDate(value),
      });
    }, [handleAndroidDismiss, handleAndroidValueChange, maximumDate, minimumDate, value]);

    const handleIOSValueChange = React.useCallback(
      (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
        onValueChange?.(fromLocalDate(selectedDate));
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
              {hasValue ? formattedValue : resolvedPlaceholder}
            </Text>
          </Pressable>
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
            <Text aria-hidden className="pe-3 text-muted-foreground" variant="body">
              ⌄
            </Text>
          )}
        </View>
        {Platform.OS === 'ios' ? (
          <Dialog onOpenChange={setOpen} open={resolvedOpen}>
            <DialogContent
              accessibilityLabel={field.accessibilityLabel ?? resolvedPlaceholder}
              testID={testID ? `${testID}-content` : undefined}
            >
              <DateTimePicker
                accessibilityLabel={field.accessibilityLabel ?? resolvedPlaceholder}
                display="inline"
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                mode="date"
                onValueChange={handleIOSValueChange}
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
