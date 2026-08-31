import { cn, type CalendarDate } from '@beemvp/beeui-core';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Calendar } from './calendar';
import { resolveCalendarLocale } from './calendar-locale';
import {
  DATE_PICKER_DEFAULT_CLEAR_ACCESSIBILITY_LABEL,
  DATE_PICKER_DEFAULT_PLACEHOLDER,
  useDatePickerFieldIntegration,
  useDatePickerOpenState,
  type DatePickerProps,
} from './date-picker-shared';
import { getDatePickerFormattedValue } from './date-picker-locale';
import { IconButton } from './icon-button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Text } from './text';

export * from './date-picker-shared';

// Web presentation (ADR-008, Decision "Web presentation" + Option C2): the trigger opens
// BeeUI's own `Calendar` inside `Popover`, reusing its existing anchored-overlay geometry,
// Escape/outside-press dismissal, and focus-restoration contract — no new overlay engine,
// no new escape handler. The clear affordance is a separate sibling `Pressable` (not
// nested inside the trigger's own `Pressable`) so pressing it never also toggles the
// popover open via event bubbling through two interactive controls.

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

export const DatePicker = React.forwardRef<React.ComponentRef<typeof Pressable>, DatePickerProps>(
  (props, forwardedRef) => {
    const hasOpenProp = Object.prototype.hasOwnProperty.call(props, 'open');
    const {
      accessibilityLabel,
      align = 'start',
      className,
      clearAccessibilityLabel = DATE_PICKER_DEFAULT_CLEAR_ACCESSIBILITY_LABEL,
      clearable = true,
      closeOnOutsidePress = true,
      collisionPadding,
      defaultOpen,
      direction,
      disabled: disabledProp,
      flip,
      formatValue,
      invalid: invalidProp,
      isDateDisabled,
      locale: localeProp,
      max,
      min,
      nextMonthAccessibilityLabel,
      onOpenChange,
      onValueChange,
      open,
      placeholder = DATE_PICKER_DEFAULT_PLACEHOLDER,
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

    const anchorRef = React.useRef<React.ComponentRef<typeof Pressable> | null>(null);
    const setTriggerRef = React.useCallback(
      (node: React.ComponentRef<typeof Pressable> | null) => {
        anchorRef.current = node;
        assignRef(forwardedRef, node);
      },
      [forwardedRef],
    );
    const calendarRef = React.useRef<React.ComponentRef<typeof Calendar> | null>(null);

    // `readOnly` keeps the trigger focusable/announced (unlike `disabled`) but blocks
    // opening, mirroring `Calendar`'s own `readOnly` semantics. Gating the `Popover`'s
    // own `open`/`onOpenChange` wiring (rather than `PopoverTrigger`'s `onPress`, which
    // already unconditionally toggles internally) avoids a double-toggle: `PopoverTrigger`
    // calls its own `setOpen(!open)` after any `onPress` passed to it, so a second
    // manual toggle there would race with it.
    const effectiveOpen = readOnly ? false : resolvedOpen;
    const handlePopoverOpenChange = React.useCallback(
      (nextOpen: boolean) => {
        if (readOnly && nextOpen) return;
        setOpen(nextOpen);
      },
      [readOnly, setOpen],
    );

    // Focus restoration to the trigger on close (ADR-008): reuses the exact
    // open->closed transition pattern `Select` already uses (`select.tsx:246-251`) rather
    // than a new escape/focus handler — `Popover`'s own Escape/outside-press dismissal
    // already routes through `onOpenChange`, so this effect covers every close path.
    const previousOpenRef = React.useRef(effectiveOpen);
    React.useEffect(() => {
      const wasOpen = previousOpenRef.current;
      previousOpenRef.current = effectiveOpen;
      if (wasOpen && !effectiveOpen) anchorRef.current?.focus?.();
    }, [effectiveOpen]);

    // Moves focus into the Calendar's roving-tabindex target when the popover opens
    // (WAI-ARIA Date Picker Dialog pattern), mirroring `SelectContent`'s own
    // open->focus-current-item effect (`select.tsx:582-585`) rather than a Calendar API
    // change: `Calendar` deliberately never auto-focuses on mount/update by itself
    // (`calendar.tsx`'s `gridHasFocusRef` gate only maintains focus once the grid
    // already has it), so establishing the *initial* focus when a consumer opens it in
    // an overlay is that consumer's job. `calendarRef.current` is the underlying DOM
    // node on Web (`Calendar` forwards its ref straight to the root `View`); this is a
    // Web-only DOM query, inert (optional-chained) under `@testing-library/react-native`
    // where the ref is a non-DOM test-renderer instance.
    //
    // `PopoverContent` renders its children immediately on open but keeps them
    // `aria-hidden`/unfocusable until its anchored-overlay position resolves
    // (`popover.tsx`'s `styles.measuring`) — a browser can silently drop a `.focus()`
    // call made while an ancestor is still `aria-hidden`. Retrying across a bounded
    // number of animation frames (capped, not unbounded — never spins forever) covers
    // that one- or two-frame measurement window without a hard-coded delay.
    React.useEffect(() => {
      if (!effectiveOpen) return;
      let frame = 0;
      let cancelled = false;
      const tryFocus = (attemptsLeft: number) => {
        if (cancelled) return;
        // Scoped to `[role="cell"]` (`calendar.tsx`'s day-cell `Pressable`): the
        // Calendar's month-navigation `IconButton`s are also real focusable
        // `<button>`s with `tabindex="0"` and precede the grid in document order, so
        // an unscoped `[tabindex="0"]` query matches "previous month" instead of the
        // intended roving day cell.
        const target = (
          calendarRef.current as unknown as
            | { querySelector?: (selector: string) => { focus?: () => void } | null }
            | null
        )?.querySelector?.('[role="cell"][tabindex="0"]');
        target?.focus?.();
        // `document` is a DOM-only global not declared in this package's `lib`
        // (`tsconfig.base.json` intentionally omits `dom` — `@beemvp/beeui-ui` is RN-first);
        // reading it through `globalThis` keeps this Web-only check type-safe without
        // widening the whole package's ambient type surface.
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
      ? (formatValue ?? getDatePickerFormattedValue)(value, locale)
      : undefined;
    const hasValue = formattedValue !== undefined;
    const showClear = clearable && hasValue && !field.disabled && !readOnly;

    const handleSelect = React.useCallback(
      (date: CalendarDate) => {
        onValueChange?.(date);
        setOpen(false);
      },
      [onValueChange, setOpen],
    );

    // The clear affordance is a sibling `Pressable` of the trigger `Pressable` (not
    // nested inside it), so there is no ancestor to receive a bubbled press event —
    // clearing never also toggles the popover open.
    const handleClear = React.useCallback(() => {
      onValueChange?.(null);
    }, [onValueChange]);

    return (
      <Popover onOpenChange={handlePopoverOpenChange} open={effectiveOpen}>
        <View
          className={cn(
            'min-h-11 min-w-48 flex-row items-center rounded-md border border-border-strong bg-input',
            field.disabled && 'border-disabled bg-disabled opacity-60',
            className,
          )}
          style={style}
          testID={testID}
        >
          <PopoverTrigger
            ref={setTriggerRef}
            // `aria-expanded` is set explicitly (not left to `accessibilityState.expanded`
            // alone) for the same reason `Button` sets `aria-busy` explicitly
            // (`button.tsx`): react-native-web's `createDOMProps` reads individual
            // `aria-*` props directly and never reads the compound
            // `accessibilityState` object on Web, so `accessibilityState.expanded`
            // (which `PopoverTrigger` already sets) never reaches the DOM here.
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
            // `pe-3` lives on this wrapping `View`, not the `Text` itself:
            // react-native-web renders `Text` with `dir="auto"` on Web,
            // which lets the browser's per-element bidi auto-detection
            // override the *inherited* ambient direction for that one node
            // when its own content (a directionless chevron glyph) has no
            // strong bidi character — `padding-inline-end` would then
            // resolve against that node's own (wrong) resolved direction
            // instead of the ambient one. `View` carries no such `dir`
            // attribute and reliably inherits the ambient direction (found
            // via #142's real-Chromium RTL stress matrix,
            // `component-rtl-stress-showcase.spec.ts`).
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
          className="gap-0 p-3"
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
            onValueChange={handleSelect}
            previousMonthAccessibilityLabel={previousMonthAccessibilityLabel}
            readOnly={readOnly}
            testID={testID ? `${testID}-calendar` : undefined}
            value={value}
            weekStartsOn={weekStartsOnProp}
          />
        </PopoverContent>
      </Popover>
    );
  },
);

DatePicker.displayName = 'DatePicker';
