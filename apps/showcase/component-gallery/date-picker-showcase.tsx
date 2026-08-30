import { Card, DatePicker, Field, Section, Text, VStack, type CalendarDate } from '@beeui/ui';
import * as React from 'react';

// BeeUI issue #173 (R4F.3, ADR-008 "DatePicker" contract). A minimal, representative
// gallery fixture for Playwright browser-interaction evidence: keyboard grid
// navigation inside the Popover-hosted Calendar, Escape dismissal, focus restoration,
// clearing, and Field validation. Deterministic behavior (selection, clearing,
// bounds/disabled dates, Field error semantics, controlled-state edge cases) already
// has Jest coverage in `apps/showcase/__tests__/issue-173-date-picker-web.test.tsx`;
// this fixture exists for what only a real browser can prove.

const MIN_DATE: CalendarDate = { day: 5, month: 1, year: 2026 };
const MAX_DATE: CalendarDate = { day: 25, month: 1, year: 2026 };

function isWeekend(date: CalendarDate): boolean {
  const dayOfWeek = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

export function DatePickerShowcase() {
  const [controlledValue, setControlledValue] = React.useState<CalendarDate | null>({
    day: 15,
    month: 1,
    year: 2026,
  });
  // Seeded to a January 2026 weekday (not `null`) so the Calendar's initial visible
  // month is deterministic — an unset `value` would fall back to the current system
  // month, which would not reliably overlap this fixture's `min`/`max` window.
  const [boundedValue, setBoundedValue] = React.useState<CalendarDate | null>({
    day: 15,
    month: 1,
    year: 2026,
  });
  const [fieldValue, setFieldValue] = React.useState<CalendarDate | null>(null);

  return (
    <VStack gap="lg">
      <Card className="gap-5" variant="raised">
        <Section
          description="Controlled selected value, formatted display, and an explicit clear affordance."
          title="Controlled DatePicker"
        >
          <VStack gap="xs">
            <DatePicker
              onValueChange={setControlledValue}
              testID="date-picker-showcase-controlled"
              value={controlledValue}
            />
            <Text testID="date-picker-showcase-controlled-state" tone="muted" variant="caption">
              {`value: ${controlledValue ? `${controlledValue.year}-${controlledValue.month}-${controlledValue.day}` : 'null'}`}
            </Text>
          </VStack>
        </Section>
      </Card>

      <Card className="gap-5">
        <Section
          description="min/max bounds and a weekend isDateDisabled predicate block selection in the Calendar grid."
          title="Bounded / disabled dates"
        >
          <DatePicker
            isDateDisabled={isWeekend}
            max={MAX_DATE}
            min={MIN_DATE}
            onValueChange={setBoundedValue}
            testID="date-picker-showcase-bounded"
            value={boundedValue}
          />
        </Section>
      </Card>

      <Card className="gap-5">
        <Section description="Field-integrated trigger derives label/required/error." title="Field validation">
          <Field
            error={fieldValue ? undefined : 'Date of birth is required'}
            invalid={!fieldValue}
            label="Date of birth"
            required
          >
            <DatePicker
              onValueChange={setFieldValue}
              testID="date-picker-showcase-field"
              value={fieldValue}
            />
          </Field>
        </Section>
      </Card>
    </VStack>
  );
}
