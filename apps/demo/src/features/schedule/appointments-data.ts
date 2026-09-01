import type { CalendarDate, ClockTime } from '@beemvp/beeui-ui';
import { demoScenarioToMockOutcome, type DemoScenario } from '../../state/demo-scenario';
import { mockFetch } from '../../services';
import { addCalendarDays, today } from './date-time-utils';

/**
 * Scheduling domain (#262). Fixture dates are generated relative to `today()`
 * (not hardcoded literals) so the demo always shows a realistic mix of past
 * and upcoming appointments no matter when the app is opened.
 */
export type Appointment = {
  id: string;
  title: string;
  attendee: string;
  date: CalendarDate;
  time: ClockTime;
  notes?: string;
};

function buildFixtures(): Appointment[] {
  const base = today();
  return [
    {
      id: 'appt-1',
      title: 'Follow-up call: TCK-10482 billing export outage',
      attendee: 'Priya Natarajan',
      date: addCalendarDays(base, -3),
      time: { hour: 14, minute: 0 },
      notes: 'Review the export worker pool timeout fix with the customer.',
    },
    {
      id: 'appt-2',
      title: 'Weekly support desk sync',
      attendee: 'Grace Hopper',
      date: addCalendarDays(base, 1),
      time: { hour: 9, minute: 30 },
    },
    {
      id: 'appt-3',
      title: 'Onboarding walkthrough: enterprise SSO metadata',
      attendee: 'Alan Turing',
      date: addCalendarDays(base, 1),
      time: { hour: 15, minute: 0 },
      notes: 'Bring the updated SAML metadata for the compliance audit.',
    },
    {
      id: 'appt-4',
      title: 'Quarterly API usage review',
      attendee: 'Ola Nordmann',
      date: addCalendarDays(base, 4),
      time: { hour: 11, minute: 0 },
    },
    {
      id: 'appt-5',
      title: 'Webhook backoff regression demo',
      attendee: 'Ada Lovelace',
      date: addCalendarDays(base, 7),
      time: { hour: 16, minute: 30 },
      notes: 'Show the corrected exponential backoff behavior end to end.',
    },
  ];
}

let appointments: Appointment[] = buildFixtures();

export function getAllAppointments(): Appointment[] {
  return appointments;
}

export function addAppointmentFixture(appointment: Omit<Appointment, 'id'>): Appointment {
  const created: Appointment = { ...appointment, id: `appt-${Date.now()}-${appointments.length}` };
  appointments = [...appointments, created];
  return created;
}

export function removeAppointmentFixture(id: string): void {
  appointments = appointments.filter((appointment) => appointment.id !== id);
}

/** Test-only reset hook so fixtures don't leak state across test cases. */
export function resetAppointmentFixtures(): void {
  appointments = buildFixtures();
}

export function listAppointments(scenario: DemoScenario): Promise<Appointment[]> {
  return mockFetch<Appointment[]>({
    emptyValue: [],
    errorMessage: 'Could not load the schedule. Check your connection and try again.',
    outcome: demoScenarioToMockOutcome(scenario),
    successValue: getAllAppointments(),
  });
}

export function scheduleAppointment(
  appointment: Omit<Appointment, 'id'>,
  scenario: DemoScenario,
): Promise<Appointment> {
  if (scenario === 'error') {
    return Promise.reject(new Error('Could not schedule the appointment. Check your connection and try again.'));
  }
  return Promise.resolve(addAppointmentFixture(appointment));
}

export function cancelAppointment(id: string, scenario: DemoScenario): Promise<void> {
  if (scenario === 'error') {
    return Promise.reject(new Error('Could not cancel the appointment. Check your connection and try again.'));
  }
  removeAppointmentFixture(id);
  return Promise.resolve();
}
