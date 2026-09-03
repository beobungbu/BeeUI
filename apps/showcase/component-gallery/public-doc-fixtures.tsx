import {
  Calendar,
  Card,
  FormMessage,
  Label,
  MetadataRow,
  Section,
  Text,
  useBeeToken,
  VisuallyHidden,
  VStack,
} from '@beemvp/beeui-ui';
import * as React from 'react';

/**
 * Small runtime surface for public families that are otherwise consumed only by
 * tests, private composition internals, or generated docs. Keeping these here
 * gives the public docs a real, typechecked Showcase source instead of falling
 * back to test/mock files.
 */
export function PublicDocFixtures() {
  const [date, setDate] = React.useState({ day: 3, month: 9, year: 2026 });
  const primary = useBeeToken('colors.primary');

  return (
    <VStack gap="lg" testID="public-doc-fixtures">
      <Card className="gap-4" padding="lg">
        <Section
          description="Public primitives that are normally embedded in larger application compositions."
          title="Documentation runtime fixtures"
        >
          <VStack gap="sm">
            <Label required>Project name</Label>
            <FormMessage>Example validation message</FormMessage>
            <MetadataRow
              description="Read through useBeeToken from the active Uniwind theme."
              label="colors.primary"
              value={String(primary)}
            />
            <Text>
              Visible companion text for the assistive-only content rendered immediately after it.
            </Text>
            <VisuallyHidden>
              <Text>Assistive-only VisuallyHidden fixture</Text>
            </VisuallyHidden>
          </VStack>
        </Section>
      </Card>

      <Card className="gap-4" padding="lg">
        <Section
          description="Standalone controlled Calendar using the same public API consumed by date-picker compositions."
          title="Calendar"
        >
          <Calendar onValueChange={setDate} value={date} />
        </Section>
      </Card>
    </VStack>
  );
}
