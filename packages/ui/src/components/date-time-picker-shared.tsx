import type {
  AnchoredOverlayAlign,
  AnchoredOverlayCollisionPadding,
  AnchoredOverlayDirection,
  AnchoredOverlayPlacement,
  CalendarDate,
  CalendarWeekStartsOn,
  ClockTime,
} from '@beemvp/beeui-core';
import * as React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useFieldContext } from './field-context';

// Shared types/state/logic for `DateTimePicker` (ADR-008,
// docs/decisions/008-datetime-architecture.md, #174). Mirrors `date-picker-shared.tsx`'s
// exact shape — the two components deliberately duplicate this small amount of
// controlled-`open`/`Field`-integration logic rather than sharing a module, matching
// this repo's existing convention (`date-picker-shared.tsx`'s own header comment notes
// it duplicates `Select`'s pattern rather than extracting a cross-component hook). This
// module has no platform-specific import, so it is safe to import from both
// `date-time-picker.web.tsx` and `date-time-picker.native.tsx` without leaking the
// native-only `@react-native-community/datetimepicker` import into the Web bundle.
//
// `DateTimePicker`'s controlled value is `{ date: CalendarDate; time: ClockTime } | null`
// — one coherent object (ADR-008's "one coherent controlled value model"), not two
// independently-controlled props.

export type DateTimePickerValue = {
  date: CalendarDate;
  time: ClockTime;
};

export type DateTimePickerAlign = AnchoredOverlayAlign;
export type DateTimePickerCollisionPadding = AnchoredOverlayCollisionPadding;
export type DateTimePickerDirection = AnchoredOverlayDirection;
export type DateTimePickerPlacement = AnchoredOverlayPlacement;

export type DateTimePickerProps = {
  /** Accessible name for the trigger. Falls back to the enclosing `Field`'s label. */
  accessibilityLabel?: string;
  /** Web-only: `Popover` content alignment relative to the trigger. Ignored on native. */
  align?: DateTimePickerAlign;
  className?: string;
  /** Accessible label for the clear button shown when `clearable` and a value is selected. Defaults to `'Clear date and time'`. */
  clearAccessibilityLabel?: string;
  /** Shows a clear affordance when a value is selected. Defaults to `true`. */
  clearable?: boolean;
  /** Web-only: dismiss the `Popover` on an outside press. Ignored on native. */
  closeOnOutsidePress?: boolean;
  /** Web-only: `Popover` collision padding. Ignored on native. */
  collisionPadding?: DateTimePickerCollisionPadding;
  /** Uncontrolled initial `open` state. Ignored once `open` is controlled. */
  defaultOpen?: boolean;
  /** Web-only: logical direction for the `Popover`/`Calendar`/time content. Ignored on native. */
  direction?: DateTimePickerDirection;
  /** Disables the trigger, so it cannot open the picker. Combined with the enclosing `Field`'s own `disabled`. */
  disabled?: boolean;
  /** Web-only: flips `Popover` placement to stay in the viewport. Ignored on native. */
  flip?: boolean;
  /** Overrides the default `Intl`-based formatted display. */
  formatValue?: (value: DateTimePickerValue, locale: string) => string;
  /** Accessible name for the Web hour digit field. Defaults to `'Hour'`. */
  hourAccessibilityLabel?: string;
  /**
   * Explicit-only 12/24h display override. Defaults to the resolved `locale`'s
   * `Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12` (ADR-008).
   */
  hour12?: boolean;
  /** Marks the trigger as invalid for styling and accessibility. Combined with the enclosing `Field`'s own `invalid`. */
  invalid?: boolean;
  /** Marks individual dates as disabled in the `Calendar` grid, without disabling the trigger itself. */
  isDateDisabled?: (date: CalendarDate) => boolean;
  /** Explicit-only (ADR-008) — no ambient device/browser locale auto-detection. Defaults to `'en-US'`. */
  locale?: string;
  /** Latest selectable date (inclusive), forwarded to the `Calendar`; later dates render disabled. */
  max?: CalendarDate;
  /** Earliest selectable date (inclusive), forwarded to the `Calendar`; earlier dates render disabled. */
  min?: CalendarDate;
  /** Accessible name for the Web minute digit field. Defaults to `'Minute'`. */
  minuteAccessibilityLabel?: string;
  /** Accessible label for the `Calendar`'s "next month" button. Defaults to `'Next month'`. */
  nextMonthAccessibilityLabel?: string;
  /** Controlled/uncontrolled open state — BeeUI owns Web presentation (`Popover`). */
  onOpenChange?: (open: boolean) => void;
  /** `null` signals an explicit clear (see `clearable`). */
  onValueChange?: (value: DateTimePickerValue | null) => void;
  /** Controls whether the picker (Web `Popover`, native system picker) is open. Requires `onOpenChange`; otherwise falls back to internal open state with a dev-mode warning. */
  open?: boolean;
  /** Accessible name for the Web AM/PM control. Defaults to `'AM or PM'`. */
  periodAccessibilityLabel?: string;
  /** Text shown on the trigger when no value is selected. Defaults to `'Select a date and time'`. */
  placeholder?: string;
  /** Web-only: `Popover` placement relative to the trigger. Ignored on native. */
  placement?: DateTimePickerPlacement;
  /** Accessible label for the `Calendar`'s "previous month" button. Defaults to `'Previous month'`. */
  previousMonthAccessibilityLabel?: string;
  /** Keeps the trigger focusable/announced but blocks opening and clearing. */
  readOnly?: boolean;
  /** Web-only: `Popover` collision-shift. Ignored on native. */
  shift?: boolean;
  /** Web-only: `Popover` offset from the trigger. Ignored on native. */
  sideOffset?: number;
  /** Forwarded to the trigger's root `View`. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Controlled selected date+time (ADR-008) — single-date selection only for 1.0. */
  value: DateTimePickerValue | null;
  /** Which day starts each week row in the `Calendar`. Defaults to the convention for `locale` when omitted. */
  weekStartsOn?: CalendarWeekStartsOn;
};

export type ResolvedDateTimePickerField = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityLabelledBy?: string;
  disabled: boolean;
  invalid: boolean;
};

/**
 * `Input`'s exact `Field` integration pattern (`input.tsx:69-78`), duplicated from
 * `useDatePickerFieldIntegration` (`date-picker-shared.tsx`): OR the component's own
 * `disabled`/`invalid` with `useFieldContext()`'s, derive hint/label/labelledBy from the
 * field. No second validation engine.
 */
export function useDateTimePickerFieldIntegration(props: {
  accessibilityLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
}): ResolvedDateTimePickerField {
  const field = useFieldContext();
  const disabled = props.disabled === true || field?.disabled === true;
  const invalid = props.invalid === true || field?.invalid === true;
  const accessibilityHint = invalid ? field?.error : field?.description;
  const accessibilityLabel =
    props.accessibilityLabel ??
    (field?.required ? `${field.label}, ${field.requiredAccessibilityLabel}` : field?.label);
  return {
    accessibilityHint,
    accessibilityLabel,
    accessibilityLabelledBy: field?.labelNativeID,
    disabled,
    invalid,
  };
}

export type DateTimePickerOpenState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

/**
 * `Select`'s/`DatePicker`'s exact controlled/uncontrolled `open` precedence
 * (`date-picker-shared.tsx:125-166`), duplicated here per this module's own header
 * comment: `open` + `onOpenChange` together control it; otherwise it is internal state
 * seeded from `defaultOpen`.
 */
export function useDateTimePickerOpenState(props: {
  defaultOpen?: boolean;
  /**
   * Whether the consumer's own `DateTimePickerProps` object has `open` as an own key —
   * must be computed from that original props object, not from this hook's own
   * argument object, which always has an `open` key of its own regardless of what the
   * consumer passed.
   */
  hasOpenProp: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}): DateTimePickerOpenState {
  const { defaultOpen = false, hasOpenProp, onOpenChange, open } = props;
  const openControlled = hasOpenProp && typeof onOpenChange === 'function' && open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(
    hasOpenProp && open !== undefined ? open : defaultOpen,
  );
  const resolvedOpen = openControlled && open !== undefined ? open : internalOpen;

  React.useEffect(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    if (hasOpenProp && !onOpenChange) {
      console.warn(
        'BeeUI DateTimePicker: `open` requires `onOpenChange`. Falling back to dismissable uncontrolled behavior.',
      );
    }
  }, [hasOpenProp, onOpenChange]);

  React.useEffect(() => {
    if (!openControlled && hasOpenProp && open !== undefined) setInternalOpen(open);
  }, [hasOpenProp, open, openControlled]);

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!openControlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, openControlled],
  );

  return { open: resolvedOpen, setOpen };
}

export const DATE_TIME_PICKER_DEFAULT_PLACEHOLDER = 'Select a date and time';
export const DATE_TIME_PICKER_DEFAULT_CLEAR_ACCESSIBILITY_LABEL = 'Clear date and time';
export const DATE_TIME_PICKER_DEFAULT_HOUR_ACCESSIBILITY_LABEL = 'Hour';
export const DATE_TIME_PICKER_DEFAULT_MINUTE_ACCESSIBILITY_LABEL = 'Minute';
export const DATE_TIME_PICKER_DEFAULT_PERIOD_ACCESSIBILITY_LABEL = 'AM or PM';
