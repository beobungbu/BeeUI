import { type CalendarDate } from '@beeui/core';
import { Field } from '@beeui/ui';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { View } from 'react-native';
import { clearActiveAnchorSeam, createAnchorSeam } from './helpers/select-anchor-seam';
import { OverlayRuntimeProvider } from '../../../packages/ui/src/components/overlay-runtime';
// Explicit `.web` suffix (mirrors `issue-19-overlay-runtime.test.tsx`'s
// `overlay-dismiss-events.web` import): Jest's default RN/`jest-expo` platform
// resolution picks the `.native.tsx` sibling for an extensionless `./date-picker`
// import, so exercising the Web presentation deterministically requires importing
// this exact file rather than going through the `@beeui/ui` barrel.
import { DatePicker } from '../../../packages/ui/src/components/date-picker.web';

// BeeUI issue #173 (R4F.3, ADR-008 "DatePicker" contract). Deterministic
// rendering-contract tests for the Web presentation: controlled value/formatting,
// selection + close, explicit clear policy, bounds/disabled-date forwarding to
// `Calendar`, `Field` integration, and disabled/read-only/controlled-open edge cases.
// Browser interaction evidence (keyboard grid navigation, Escape, focus restoration)
// is Playwright's responsibility (`apps/visual-regression/tests/date-picker-showcase.spec.ts`),
// not this file's.
//
// Anchor/host measurement uses `./helpers/select-anchor-seam` rather than plain
// `createNodeMock`: under the current jest-expo/React 19 environment, RN host
// component instance methods (including `measureInWindow`) never actually reach
// `createNodeMock`'s result (documented in that helper), so the same
// prototype-patching seam Select's own contract tests rely on is reused here.

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = require('react');
  const { View: RNView } = require('react-native');
  const insets = { top: 20, right: 0, bottom: 30, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 640 };
  return {
    initialWindowMetrics: { frame, insets },
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaListener: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ReactActual.forwardRef(
      ({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<typeof RNView>) => (
        <RNView ref={ref} {...props}>
          {children}
        </RNView>
      ),
    ),
    useSafeAreaInsets: () => insets,
  };
});

const HOST_RECT = { x: 0, y: 0, width: 320, height: 640 };
const TRIGGER_RECT = { x: 20, y: 40, width: 200, height: 44 };
const JAN_15_2026: CalendarDate = { day: 15, month: 1, year: 2026 };

afterEach(() => {
  clearActiveAnchorSeam();
});

function renderDatePicker(ui: React.ReactNode) {
  createAnchorSeam({
    match: (testID) => testID === 'date-picker-trigger',
    rectFor: () => TRIGGER_RECT,
    modalHostRect: HOST_RECT,
  });
  return render(<OverlayRuntimeProvider hostRectOverride={HOST_RECT}>{ui}</OverlayRuntimeProvider>);
}

async function open(screen: ReturnType<typeof renderDatePicker>) {
  fireEvent.press(screen.getByTestId('date-picker-trigger'));
  const content = await waitFor(() =>
    screen.getByTestId('date-picker-content', { includeHiddenElements: true }),
  );
  // The RN test renderer never fires a real `onLayout`; the anchored-overlay position
  // needs the content's own measured size before it resolves out of "measuring" state
  // (mirrors `wave-2a-select.test.tsx`'s `layoutOpenSelectContents` helper).
  fireEvent(content, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 280, height: 320 } } });
  await waitFor(() =>
    expect(screen.getByTestId('date-picker-content', { includeHiddenElements: true }).props.pointerEvents).toBe(
      'auto',
    ),
  );
}

describe('BeeUI issue #173 DatePicker (Web) rendering contract', () => {
  it('renders the placeholder when unset and the formatted value when controlled-set', () => {
    const screen = renderDatePicker(
      <DatePicker placeholder="Pick a date" testID="date-picker" value={null} />,
    );
    expect(screen.getByTestId('date-picker-value').props.children).toBe('Pick a date');

    screen.rerender(
      <OverlayRuntimeProvider hostRectOverride={HOST_RECT}>
        <DatePicker placeholder="Pick a date" testID="date-picker" value={JAN_15_2026} />
      </OverlayRuntimeProvider>,
    );
    expect(screen.getByTestId('date-picker-value').props.children).toBe('Jan 15, 2026');
  });

  it('supports a custom formatValue override', () => {
    const screen = renderDatePicker(
      <DatePicker
        formatValue={(date) => `${date.year}/${date.month}/${date.day}`}
        testID="date-picker"
        value={JAN_15_2026}
      />,
    );
    expect(screen.getByTestId('date-picker-value').props.children).toBe('2026/1/15');
  });

  it('opens the Calendar in a Popover on trigger press and commits a selection', async () => {
    const onValueChange = jest.fn();
    const onOpenChange = jest.fn();
    // Starting from a non-null `value` seeds the inner `Calendar`'s initial visible
    // month deterministically (no `value`/`visibleMonth` would fall back to "today",
    // which is not January 2026), so the day-15/20 test cells are guaranteed present.
    const screen = renderDatePicker(
      <DatePicker
        onOpenChange={onOpenChange}
        onValueChange={onValueChange}
        testID="date-picker"
        value={JAN_15_2026}
      />,
    );

    expect(screen.getByTestId('date-picker-trigger').props.accessibilityState.expanded).toBe(false);
    await open(screen);
    expect(screen.getByTestId('date-picker-trigger').props.accessibilityState.expanded).toBe(true);

    fireEvent.press(screen.getByTestId('date-picker-calendar-day-2026-01-20'));

    expect(onValueChange).toHaveBeenCalledWith({ day: 20, month: 1, year: 2026 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows a clear affordance for a selected value and clears without opening the popover', async () => {
    const onValueChange = jest.fn();
    const onOpenChange = jest.fn();
    const screen = renderDatePicker(
      <DatePicker
        onOpenChange={onOpenChange}
        onValueChange={onValueChange}
        testID="date-picker"
        value={JAN_15_2026}
      />,
    );

    fireEvent.press(screen.getByTestId('date-picker-clear'));

    expect(onValueChange).toHaveBeenCalledWith(null);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('date-picker-trigger').props.accessibilityState.expanded).toBe(false);
  });

  it('hides the clear affordance when there is no value or clearable is false', () => {
    const empty = renderDatePicker(<DatePicker testID="date-picker" value={null} />);
    expect(empty.queryByTestId('date-picker-clear')).toBeNull();

    const notClearable = renderDatePicker(
      <DatePicker clearable={false} testID="date-picker" value={JAN_15_2026} />,
    );
    expect(notClearable.queryByTestId('date-picker-clear')).toBeNull();
  });

  it('forwards min/max/isDateDisabled to the inner Calendar and blocks disabled-day selection', async () => {
    const onValueChange = jest.fn();
    const isDateDisabled = (date: CalendarDate) => date.day === 20;
    const screen = renderDatePicker(
      <DatePicker
        isDateDisabled={isDateDisabled}
        max={{ day: 25, month: 1, year: 2026 }}
        min={{ day: 10, month: 1, year: 2026 }}
        onValueChange={onValueChange}
        testID="date-picker"
        value={JAN_15_2026}
      />,
    );
    await open(screen);

    expect(
      screen.getByTestId('date-picker-calendar-day-2026-01-05').props.accessibilityState.disabled,
    ).toBe(true);
    expect(
      screen.getByTestId('date-picker-calendar-day-2026-01-20').props.accessibilityState.disabled,
    ).toBe(true);

    fireEvent.press(screen.getByTestId('date-picker-calendar-day-2026-01-20'));
    fireEvent.press(screen.getByTestId('date-picker-calendar-day-2026-01-05'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('derives disabled/invalid/accessibilityLabel/hint from an enclosing Field', () => {
    const screen = renderDatePicker(
      <Field error="Required" invalid label="Birthday" required>
        <DatePicker testID="date-picker" value={null} />
      </Field>,
    );
    const trigger = screen.getByTestId('date-picker-trigger');
    expect(trigger.props.accessibilityLabel).toBe('Birthday, required');
    expect(trigger.props.accessibilityHint).toBe('Required');
  });

  it('ORs its own disabled/invalid with the Field, never weakening either', () => {
    const screen = renderDatePicker(
      <Field disabled={false} label="Birthday">
        <DatePicker disabled testID="date-picker" value={null} />
      </Field>,
    );
    expect(screen.getByTestId('date-picker-trigger').props.accessibilityState.disabled).toBe(true);
  });

  it('disabled marks the trigger disabled and blocks opening', async () => {
    const onOpenChange = jest.fn();
    const screen = renderDatePicker(
      <DatePicker disabled onOpenChange={onOpenChange} testID="date-picker" value={null} />,
    );

    expect(screen.getByTestId('date-picker-trigger').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('date-picker-trigger'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('readOnly keeps the trigger enabled/announced but blocks opening and hides clear', async () => {
    const onOpenChange = jest.fn();
    const screen = renderDatePicker(
      <DatePicker onOpenChange={onOpenChange} readOnly testID="date-picker" value={JAN_15_2026} />,
    );

    expect(screen.getByTestId('date-picker-trigger').props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByTestId('date-picker-clear')).toBeNull();

    fireEvent.press(screen.getByTestId('date-picker-trigger'));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('date-picker-trigger').props.accessibilityState.expanded).toBe(false);
  });

  it('supports a fully controlled open state without mutating it itself', () => {
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <View>
          <DatePicker onOpenChange={setOpen} open={open} testID="date-picker" value={null} />
        </View>
      );
    }
    const screen = renderDatePicker(<Harness />);

    expect(screen.getByTestId('date-picker-trigger').props.accessibilityState.expanded).toBe(false);
    fireEvent.press(screen.getByTestId('date-picker-trigger'));
    expect(screen.getByTestId('date-picker-trigger').props.accessibilityState.expanded).toBe(true);
  });
});
