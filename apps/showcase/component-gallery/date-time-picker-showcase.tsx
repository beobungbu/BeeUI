import {
  Card,
  DateTimePicker,
  Field,
  Section,
  Text,
  VStack,
  type DateTimePickerValue,
} from '@beeui/ui';
import * as React from 'react';

// BeeUI issue #174 (R4F.4, ADR-008 "DateTimePicker" contract). A minimal, representative
// gallery fixture for Playwright browser-interaction evidence: keyboard grid
// navigation inside the Popover-hosted Calendar, hour/minute digit-entry focus, AM/PM
// toggling, Escape dismissal, and focus restoration. Deterministic behavior (selection,
// clearing, bounds/disabled dates, Field error semantics, controlled-state edge cases)
// already has Jest coverage in
// `apps/showcase/__tests__/issue-174-date-time-picker-web.test.tsx`; this fixture
// exists for what only a real browser can prove.

const MIN_DATE = { day: 5, month: 1, year: 2026 };
const MAX_DATE = { day: 25, month: 1, year: 2026 };

function isWeekend(date: { day: number; month: number; year: number }): boolean {
  const dayOfWeek = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

function formatValueState(value: DateTimePickerValue | null): string {
  if (!value) return 'null';
  const { date, time } = value;
  return `${date.year}-${date.month}-${date.day} ${String(time.hour).padStart(2, '0')}:${String(
    time.minute,
  ).padStart(2, '0')}`;
}

export function DateTimePickerShowcase() {
  // Seeded to a January 2026 weekday (not `null`) so the Calendar's initial visible
  // month is deterministic and the time fields have a stable starting value.
  const [controlledValue, setControlledValue] = React.useState<DateTimePickerValue | null>({
    date: { day: 15, month: 1, year: 2026 },
    time: { hour: 13, minute: 30 },
  });
  const [boundedValue, setBoundedValue] = React.useState<DateTimePickerValue | null>({
    date: { day: 15, month: 1, year: 2026 },
    time: { hour: 9, minute: 0 },
  });
  const [fieldValue, setFieldValue] = React.useState<DateTimePickerValue | null>(null);

  return (
    <VStack gap="lg">
      <Card className="gap-5" variant="raised">
        <Section
          description="Controlled selected date+time, formatted display, and an explicit clear affordance."
          title="Controlled DateTimePicker"
        >
          <VStack gap="xs">
            <DateTimePicker
              onValueChange={setControlledValue}
              testID="date-time-picker-showcase-controlled"
              value={controlledValue}
            />
            <Text testID="date-time-picker-showcase-controlled-state" tone="muted" variant="caption">
              {`value: ${formatValueState(controlledValue)}`}
            </Text>
          </VStack>
        </Section>
      </Card>

      <Card className="gap-5">
        <Section
          description="min/max bounds and a weekend isDateDisabled predicate block date selection in the Calendar grid; 24h time entry."
          title="Bounded / disabled dates, 24h time"
        >
          <DateTimePicker
            hour12={false}
            isDateDisabled={isWeekend}
            max={MAX_DATE}
            min={MIN_DATE}
            onValueChange={setBoundedValue}
            testID="date-time-picker-showcase-bounded"
            value={boundedValue}
          />
        </Section>
      </Card>

      <Card className="gap-5">
        <Section description="Field-integrated trigger derives label/required/error." title="Field validation">
          <Field
            error={fieldValue ? undefined : 'Appointment time is required'}
            invalid={!fieldValue}
            label="Appointment"
            required
          >
            <DateTimePicker
              onValueChange={setFieldValue}
              testID="date-time-picker-showcase-field"
              value={fieldValue}
            />
          </Field>
        </Section>
      </Card>
    </VStack>
  );
}
