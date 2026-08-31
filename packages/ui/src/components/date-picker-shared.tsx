import type {
  AnchoredOverlayAlign,
  AnchoredOverlayCollisionPadding,
  AnchoredOverlayDirection,
  AnchoredOverlayPlacement,
  CalendarDate,
  CalendarWeekStartsOn,
} from '@beemvp/beeui-core';
import * as React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useFieldContext } from './field-context';

// Shared types/state/logic for `DatePicker` (ADR-008, docs/decisions/008-datetime-architecture.md,
// #173). This module has no platform-specific import (no native-system-picker dependency,
// no DOM), so it is safe to import from both `date-picker.web.tsx` and
// `date-picker.native.tsx` without leaking the native-only
// `@react-native-community/datetimepicker` import into the Web bundle — that isolation
// happens at the platform-file boundary (`date-picker.web.tsx`/`.native.tsx`), not here.
//
// `DatePicker` follows Calendar's own precedent (ADR-008): `value` is controlled-only
// (`CalendarDate | null`, no `defaultValue`/internal value state). Only the Popover-hosted
// `open` state is controlled/uncontrolled, mirroring `Select`'s accepted precedent exactly.

export type DatePickerAlign = AnchoredOverlayAlign;
export type DatePickerCollisionPadding = AnchoredOverlayCollisionPadding;
export type DatePickerDirection = AnchoredOverlayDirection;
export type DatePickerPlacement = AnchoredOverlayPlacement;

export type DatePickerProps = {
  /** Accessible name for the trigger. Falls back to the enclosing `Field`'s label. */
  accessibilityLabel?: string;
  /** Web-only: `Popover` content alignment relative to the trigger. Ignored on native. */
  align?: DatePickerAlign;
  className?: string;
  clearAccessibilityLabel?: string;
  /** Shows a clear affordance when a value is selected. Defaults to `true`. */
  clearable?: boolean;
  /** Web-only: dismiss the `Popover` on an outside press. Ignored on native. */
  closeOnOutsidePress?: boolean;
  /** Web-only: `Popover` collision padding. Ignored on native. */
  collisionPadding?: DatePickerCollisionPadding;
  /** Uncontrolled initial `open` state. Ignored once `open` is controlled. */
  defaultOpen?: boolean;
  /** Web-only: logical direction for the `Popover`/`Calendar` content. Ignored on native. */
  direction?: DatePickerDirection;
  disabled?: boolean;
  /** Web-only: flips `Popover` placement to stay in the viewport. Ignored on native. */
  flip?: boolean;
  /** Overrides the default `Intl`-based formatted display. */
  formatValue?: (date: CalendarDate, locale: string) => string;
  invalid?: boolean;
  isDateDisabled?: (date: CalendarDate) => boolean;
  /** Explicit-only (ADR-008) — no ambient device/browser locale auto-detection. Defaults to `'en-US'`. */
  locale?: string;
  max?: CalendarDate;
  min?: CalendarDate;
  nextMonthAccessibilityLabel?: string;
  /** Controlled/uncontrolled open state — BeeUI owns Web presentation (`Popover`). */
  onOpenChange?: (open: boolean) => void;
  /** `null` signals an explicit clear (see `clearable`). */
  onValueChange?: (date: CalendarDate | null) => void;
  open?: boolean;
  placeholder?: string;
  /** Web-only: `Popover` placement relative to the trigger. Ignored on native. */
  placement?: DatePickerPlacement;
  previousMonthAccessibilityLabel?: string;
  /** Keeps the trigger focusable/announced but blocks opening and clearing. */
  readOnly?: boolean;
  /** Web-only: `Popover` collision-shift. Ignored on native. */
  shift?: boolean;
  /** Web-only: `Popover` offset from the trigger. Ignored on native. */
  sideOffset?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Controlled selected date (ADR-008) — single-date selection only for 1.0. */
  value: CalendarDate | null;
  weekStartsOn?: CalendarWeekStartsOn;
};

export type ResolvedDatePickerField = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityLabelledBy?: string;
  disabled: boolean;
  invalid: boolean;
};

/**
 * `Input`'s exact `Field` integration pattern (`input.tsx:69-78`): OR the component's own
 * `disabled`/`invalid` with `useFieldContext()`'s, derive hint/label/labelledBy from the
 * field. No second validation engine.
 */
export function useDatePickerFieldIntegration(props: {
  accessibilityLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
}): ResolvedDatePickerField {
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

export type DatePickerOpenState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

/**
 * `Select`'s exact controlled/uncontrolled `open` precedence (`select.tsx:159-191`):
 * `open` + `onOpenChange` together control it; otherwise it is internal state seeded from
 * `defaultOpen`. A dev-only warning covers the "controlled `open` without `onOpenChange`"
 * footgun instead of silently freezing the picker open.
 */
export function useDatePickerOpenState(props: {
  defaultOpen?: boolean;
  /**
   * Whether the consumer's own `DatePickerProps` object has `open` as an own key
   * (`Object.prototype.hasOwnProperty.call(componentProps, 'open')`) — must be computed
   * from that original props object, not from this hook's own argument object, which
   * always has an `open` key of its own regardless of what the consumer passed.
   */
  hasOpenProp: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}): DatePickerOpenState {
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
        'BeeUI DatePicker: `open` requires `onOpenChange`. Falling back to dismissable uncontrolled behavior.',
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

export const DATE_PICKER_DEFAULT_PLACEHOLDER = 'Select a date';
export const DATE_PICKER_DEFAULT_CLEAR_ACCESSIBILITY_LABEL = 'Clear date';
