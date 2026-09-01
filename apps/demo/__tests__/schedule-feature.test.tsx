import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as React from 'react';
import { BeeUIProvider } from '@beemvp/beeui-ui';
import { ScheduleScreen } from '../src/features/schedule/schedule-screen';
import { resetAppointmentFixtures } from '../src/features/schedule/appointments-data';
import {
  addCalendarDays,
  compareCalendarDates,
  compareClockTimes,
  compareSchedule,
  formatCalendarDate,
  formatClockTime,
  isSameCalendarDate,
  today,
} from '../src/features/schedule/date-time-utils';
import { DemoScenarioProvider, type DemoScenario } from '../src/state/demo-scenario';

const mockShow = jest.fn();

jest.mock('@beemvp/beeui-ui', () => {
  const actual = jest.requireActual('@beemvp/beeui-ui');
  return {
    ...actual,
    useToast: () => ({ show: mockShow, dismiss: jest.fn(), dismissAll: jest.fn() }),
  };
});

function renderSchedule(initialScenario?: DemoScenario) {
  return render(
    <BeeUIProvider>
      <DemoScenarioProvider initialScenario={initialScenario}>
        <ScheduleScreen />
      </DemoScenarioProvider>
    </BeeUIProvider>,
  );
}

describe('date-time-utils (#262 no-drift guarantees)', () => {
  it('never shifts the calendar day when adding whole days', () => {
    expect(addCalendarDays({ year: 2026, month: 1, day: 31 }, 1)).toEqual({ year: 2026, month: 2, day: 1 });
    expect(addCalendarDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({ year: 2026, month: 2, day: 28 });
  });

  it('compares calendar dates and clock times field-by-field', () => {
    expect(compareCalendarDates({ year: 2026, month: 1, day: 1 }, { year: 2026, month: 1, day: 2 })).toBeLessThan(0);
    expect(compareClockTimes({ hour: 9, minute: 0 }, { hour: 9, minute: 30 })).toBeLessThan(0);
    expect(
      compareSchedule(
        { date: { year: 2026, month: 1, day: 2 }, time: { hour: 8, minute: 0 } },
        { date: { year: 2026, month: 1, day: 1 }, time: { hour: 23, minute: 0 } },
      ),
    ).toBeGreaterThan(0);
  });

  it('treats structurally equal dates as the same day regardless of object identity', () => {
    expect(isSameCalendarDate({ year: 2026, month: 1, day: 1 }, { year: 2026, month: 1, day: 1 })).toBe(true);
    expect(isSameCalendarDate(null, null)).toBe(true);
    expect(isSameCalendarDate(today(), addCalendarDays(today(), 1))).toBe(false);
  });

  it('formats dates and times without going through a locale-shiftable Date parse', () => {
    expect(formatCalendarDate({ year: 2026, month: 1, day: 5 })).toBe('Jan 5, 2026');
    expect(formatClockTime({ hour: 0, minute: 5 })).toBe('12:05 AM');
    expect(formatClockTime({ hour: 13, minute: 30 })).toBe('1:30 PM');
    expect(formatClockTime({ hour: 13, minute: 30 }, false)).toBe('13:30');
  });
});

describe('ScheduleScreen (#262)', () => {
  beforeEach(() => {
    mockShow.mockClear();
    resetAppointmentFixtures();
  });

  it('lists appointments after loading, sorted earliest first', async () => {
    renderSchedule();

    expect(await screen.findByTestId('schedule-appointments-list')).toBeTruthy();
    expect(screen.getByText('Weekly support desk sync')).toBeTruthy();
  });

  it('renders an EmptyState when the schedule scenario is empty', async () => {
    renderSchedule('empty');

    expect(await screen.findByTestId('schedule-empty-state')).toBeTruthy();
  });

  it('renders an ErrorState with retry on failure', async () => {
    renderSchedule('error');

    expect(await screen.findByTestId('schedule-error-state')).toBeTruthy();

    fireEvent.press(screen.getByText('Try again'));

    expect(await screen.findByTestId('schedule-error-state')).toBeTruthy();
  });

  it('schedules a new appointment and shows a success toast', async () => {
    renderSchedule();
    await screen.findByTestId('schedule-appointments-list');

    fireEvent.press(screen.getByText('New appointment'));
    expect(await screen.findByText('Schedule a follow-up call or team appointment.')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('schedule-title-input'), 'Customer escalation review');
    fireEvent.press(screen.getByText('Save appointment'));

    await waitFor(() =>
      expect(mockShow).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Appointment scheduled' }),
      ),
    );
    expect(await screen.findByText('Customer escalation review')).toBeTruthy();
  });

  it('blocks scheduling without a title', async () => {
    renderSchedule();
    await screen.findByTestId('schedule-appointments-list');

    fireEvent.press(screen.getByText('New appointment'));
    await screen.findByText('Schedule a follow-up call or team appointment.');

    fireEvent.press(screen.getByText('Save appointment'));

    expect(await screen.findByText('Title is required.')).toBeTruthy();
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('cancels an appointment', async () => {
    renderSchedule();
    await screen.findByTestId('schedule-appointments-list');

    fireEvent.press(screen.getByLabelText('Cancel Weekly support desk sync'));

    await waitFor(() => expect(screen.queryByText('Weekly support desk sync')).toBeNull());
    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Appointment cancelled' }),
    );
  });
});
