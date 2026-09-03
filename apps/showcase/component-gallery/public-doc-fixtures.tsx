import {
  Calendar,
  FormMessage,
  Label,
  MetadataRow,
  Text,
  VisuallyHidden,
  VStack,
  useBeeToken,
  type CalendarDate,
} from '@beemvp/beeui-ui';
import * as React from 'react';

/**
 * Small runtime-only fixtures for public exports that are otherwise consumed
 * indirectly by composite Showcase examples. Keeping them here gives the
 * generated component reference a real, executable public-boundary source
 * instead of falling back to Jest/test harnesses.
 */
export function PublicDocFixtures() {
  const [date, setDate] = React.useState<CalendarDate | null>({ day: 15, month: 1, year: 2026 });
  const primary = useBeeToken('colors.primary');

  return (
    <VStack gap="md" testID="public-doc-runtime-fixtures">
      <Label required>Account email</Label>
      <FormMessage>Use a valid email address.</FormMessage>

      <MetadataRow
        description="Runtime fixture used by the generated public reference."
        label="Environment"
        value="Showcase"
      />

      <Calendar
        defaultVisibleMonth={{ month: 1, year: 2026 }}
        onValueChange={setDate}
        testID="public-doc-calendar"
        value={date}
      />

      <Text testID="public-doc-token-value">{`colors.primary: ${primary}`}</Text>

      <VisuallyHidden testID="public-doc-visually-hidden">
        <Text>Assistive-only runtime fixture</Text>
      </VisuallyHidden>
    </VStack>
  );
}
