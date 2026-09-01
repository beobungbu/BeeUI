import {
  Badge,
  Button,
  Calendar,
  Card,
  DateTimePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  KeyboardAwareScreen,
  ListGroup,
  ListItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Text,
  Textarea,
  VStack,
  useToast,
  type CalendarDate,
  type DateTimePickerValue,
} from '@beemvp/beeui-ui';
import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { useAsync } from '../../services';
import { useDemoScenario } from '../../state/demo-scenario';
import {
  cancelAppointment,
  listAppointments,
  scheduleAppointment,
  type Appointment,
} from './appointments-data';
import { compareSchedule, formatCalendarDate, formatClockTime, isSameCalendarDate, today } from './date-time-utils';

const ATTENDEES = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Priya Natarajan'] as const;

function ScheduleSkeleton() {
  return (
    <VStack gap="sm" testID="schedule-skeleton">
      {[0, 1, 2].map((row) => (
        <Skeleton className="h-16 w-full" key={row} />
      ))}
    </VStack>
  );
}

/** Reads a possibly-array route param as a single optional string. */
function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function ScheduleScreen() {
  const toast = useToast();
  const { scenario } = useDemoScenario();
  const params = useLocalSearchParams<{ ticketId?: string; title?: string; attendee?: string }>();
  const { data, error, retry, status } = useAsync(() => listAppointments(scenario), [scenario], {
    isEmpty: (appointments) => appointments.length === 0,
  });

  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  React.useEffect(() => {
    if (status === 'success') setAppointments(data);
  }, [data, status]);

  const [selectedDate, setSelectedDate] = React.useState<CalendarDate | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [attendee, setAttendee] = React.useState<string>(ATTENDEES[0]);
  const [dateTime, setDateTime] = React.useState<DateTimePickerValue | null>({
    date: today(),
    time: { hour: 9, minute: 0 },
  });
  const [notes, setNotes] = React.useState('');
  const [titleError, setTitleError] = React.useState<string | undefined>();
  const [formError, setFormError] = React.useState<string | undefined>();
  const [saving, setSaving] = React.useState(false);
  const [followUpTicketId, setFollowUpTicketId] = React.useState<string | undefined>();

  // Cross-flow handoff (#237 "record detail -> schedule" realistic flow):
  // `RecordDetailScreen`'s "Schedule follow-up" action routes here with a
  // pre-filled title/attendee. Applied at most once per navigation (a ref
  // guard, not a second data-fetching framework) so re-renders never re-open
  // a dialog the reviewer already dismissed.
  const appliedHandoffRef = React.useRef(false);
  React.useEffect(() => {
    if (appliedHandoffRef.current) return;
    const paramTitle = firstParam(params.title);
    if (!paramTitle) return;
    appliedHandoffRef.current = true;

    const paramAttendee = firstParam(params.attendee);
    setTitle(paramTitle);
    if (paramAttendee && (ATTENDEES as readonly string[]).includes(paramAttendee)) {
      setAttendee(paramAttendee);
    }
    setFollowUpTicketId(firstParam(params.ticketId));
    setDateTime({ date: today(), time: { hour: 9, minute: 0 } });
    setDialogOpen(true);
  }, [params.attendee, params.ticketId, params.title]);

  const visibleAppointments = React.useMemo(() => {
    const scoped = selectedDate
      ? appointments.filter((appointment) => isSameCalendarDate(appointment.date, selectedDate))
      : appointments;
    return [...scoped].sort(compareSchedule);
  }, [appointments, selectedDate]);

  function resetForm() {
    setTitle('');
    setAttendee(ATTENDEES[0]);
    setDateTime({ date: selectedDate ?? today(), time: { hour: 9, minute: 0 } });
    setNotes('');
    setTitleError(undefined);
    setFormError(undefined);
    setFollowUpTicketId(undefined);
  }

  function openDialog() {
    resetForm();
    setDialogOpen(true);
  }

  async function handleSchedule() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError('Title is required.');
      return;
    }
    if (!dateTime) {
      setFormError('Pick a date and time.');
      return;
    }

    setSaving(true);
    setFormError(undefined);
    try {
      const created = await scheduleAppointment(
        { title: trimmedTitle, attendee, date: dateTime.date, time: dateTime.time, notes: notes.trim() || undefined },
        scenario,
      );
      setAppointments((previous) => [...previous, created]);
      setDialogOpen(false);
      toast.show({
        title: 'Appointment scheduled',
        description: `${created.title} on ${formatCalendarDate(created.date)}.`,
        variant: 'success',
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not schedule the appointment.';
      setFormError(message);
      toast.show({ title: 'Scheduling failed', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(appointment: Appointment) {
    try {
      await cancelAppointment(appointment.id, scenario);
      setAppointments((previous) => previous.filter((item) => item.id !== appointment.id));
      toast.show({ title: 'Appointment cancelled', description: appointment.title });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not cancel the appointment.';
      toast.show({ title: 'Cancel failed', description: message, variant: 'destructive' });
    }
  }

  return (
    <KeyboardAwareScreen contentWidth="lg">
      <VStack className="py-4" gap="md">
        <VStack className="flex-row items-start justify-between" gap="sm">
          <VStack gap="xs">
            <Text variant="title">Schedule</Text>
            <Text tone="muted" variant="body">
              Follow-up calls and team appointments.
            </Text>
          </VStack>
          <Button onPress={openDialog}>New appointment</Button>
        </VStack>

        <Calendar
          accessibilityLabel="Pick a day to filter appointments"
          onValueChange={setSelectedDate}
          value={selectedDate}
        />

        {selectedDate ? (
          <VStack className="flex-row items-center justify-between">
            <Text tone="muted" variant="caption">
              {`Showing ${formatCalendarDate(selectedDate)}`}
            </Text>
            <Button onPress={() => setSelectedDate(null)} variant="ghost">
              Show all
            </Button>
          </VStack>
        ) : null}

        {status === 'loading' || status === 'idle' ? (
          <ScheduleSkeleton />
        ) : status === 'error' ? (
          <Card variant="outlined">
            <ErrorState action={<Button onPress={retry}>Try again</Button>} description={error.message} testID="schedule-error-state" />
          </Card>
        ) : status === 'empty' ? (
          <Card variant="outlined">
            <EmptyState
              action={<Button onPress={openDialog}>Schedule appointment</Button>}
              description="Nothing is on the calendar yet."
              testID="schedule-empty-state"
              title="No appointments scheduled"
            />
          </Card>
        ) : visibleAppointments.length === 0 ? (
          <Card variant="outlined">
            <EmptyState description="No appointments on this day." testID="schedule-no-results-state" title="Nothing scheduled" />
          </Card>
        ) : (
          <ListGroup testID="schedule-appointments-list">
            {visibleAppointments.map((appointment) => (
              <ListItem
                description={`${appointment.attendee} · ${formatCalendarDate(appointment.date)} at ${formatClockTime(appointment.time)}`}
                key={appointment.id}
                title={appointment.title}
                trailing={
                  <IconButton
                    accessibilityLabel={`Cancel ${appointment.title}`}
                    onPress={() => handleCancel(appointment)}
                    variant="ghost"
                  >
                    ✕
                  </IconButton>
                }
              />
            ))}
          </ListGroup>
        )}

        <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
          <DialogContent>
            <DialogTitle>New appointment</DialogTitle>
            <DialogDescription>Schedule a follow-up call or team appointment.</DialogDescription>

            {followUpTicketId ? (
              <Text testID="schedule-followup-hint" tone="muted" variant="caption">
                {`Following up on ${followUpTicketId}.`}
              </Text>
            ) : null}

            {formError ? (
              <Text role="alert" testID="schedule-form-error" tone="destructive" variant="caption">
                {formError}
              </Text>
            ) : null}

            <Field error={titleError} invalid={Boolean(titleError)} label="Title" required>
              <Textarea
                accessibilityLabel="Title"
                numberOfLines={1}
                onChangeText={setTitle}
                testID="schedule-title-input"
                value={title}
              />
            </Field>

            <Field label="Attendee">
              <Select onValueChange={setAttendee} value={attendee}>
                <SelectTrigger accessibilityLabel="Attendee">
                  <SelectValue placeholder="Choose an attendee" />
                </SelectTrigger>
                <SelectContent>
                  {ATTENDEES.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Date & time">
              <DateTimePicker min={today()} onValueChange={setDateTime} value={dateTime} />
            </Field>

            <Field description="Optional context for the attendee." label="Notes">
              <Textarea accessibilityLabel="Notes" numberOfLines={3} onChangeText={setNotes} value={notes} />
            </Field>

            <DialogFooter>
              <Button onPress={() => setDialogOpen(false)} variant="outline">
                Cancel
              </Button>
              <Button loading={saving} onPress={handleSchedule}>
                Save appointment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </VStack>
    </KeyboardAwareScreen>
  );
}
