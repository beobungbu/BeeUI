import {
  Avatar,
  Box,
  Spinner,
  Stepper,
  StepperItem,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

/**
 * Consumer-shaped colour and typography fixture. Every node here is written the way an
 * application writes it, with no colour class on any ancestor except the page background,
 * so a component that relies on the document's inherited colour shows up as black text on
 * the dark surface instead of being masked by a harness-provided `text-foreground`.
 */
export function ColorTypographyFixture() {
  const rowNumber = 2;

  return (
    <Box className="min-h-screen gap-6 bg-background p-6" testID="color-typography-fixture">
      <Box className="gap-2">
        <Text className="text-caption" testID="typography-caption-class">
          Caption through the className step
        </Text>
        <Text testID="typography-caption-variant" variant="caption">
          Caption through the variant
        </Text>
      </Box>

      <Box className="flex-row items-center gap-3">
        <Avatar fallback="SM" size="sm" testID="avatar-sm" />
        <Avatar fallback="MD" size="md" testID="avatar-md" />
        <Avatar fallback="LG" size="lg" testID="avatar-lg" />
        <Avatar fallback="XL" size="xl" testID="avatar-xl" />
      </Box>

      <Table testID="color-table">
        <TableCaption testID="color-table-caption">Recent transactions</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell testID="color-table-plain-cell">Alpha Store</TableCell>
            <TableCell testID="color-table-mixed-cell">Row {rowNumber}</TableCell>
          </TableRow>
          <TableRow selected>
            <TableCell testID="color-table-selected-cell">Beta Market</TableCell>
            <TableCell>TXN-0002</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Stepper currentStep={2}>
        <StepperItem step={1} testID="stepper-complete" title="Cart" />
        <StepperItem step={2} testID="stepper-current" title="Payment" />
        <StepperItem step={3} testID="stepper-upcoming" title="Receipt" />
      </Stepper>

      <Box className="flex-row items-center gap-4">
        <Spinner testID="accent-spinner" />
        <Switch accessibilityLabel="Accent switch" onValueChange={() => undefined} testID="accent-switch" value />
      </Box>
    </Box>
  );
}
