import {
  Box,
  Button,
  Field,
  Input,
  Pagination,
  PaginationItem,
  SafeArea,
  Screen,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Text,
  VStack,
} from '@beemvp/beeui-ui';
import * as React from 'react';
import { PixelRatio, ScrollView } from 'react-native';

/**
 * Dynamic Type runtime fixture (#143).
 *
 * Native font-scale evidence must not depend on traversing the full Component
 * Gallery: real OS font scaling expands every preceding section, so a deep
 * scroll target cannot be reached within any fixed scroll budget once text is
 * scaled. This screen puts the audited targets one tap from Showcase home,
 * directly at the top of the viewport, so automation asserts them without
 * scrolling at every audited scale (1.0/1.3/1.5/2.0).
 *
 * This screen intentionally renders no AppHeader: the fixture must stay
 * measurable even while AppHeader has its own large-text defect (#284), and a
 * measurement surface must not couple to an unrelated component's failure.
 *
 * The font-scale label is the in-app proof that the OS-level setting actually
 * reached this process; the harness asserts its exact text before measuring.
 */
export function DynamicTypeAcceptance({ onBack }: { onBack: () => void }) {
  const [plan, setPlan] = React.useState('pro');
  const [page, setPage] = React.useState(1);
  const fontScale = PixelRatio.getFontScale();

  return (
    <Screen testID="dynamic-type-screen">
      <SafeArea className="flex-1 bg-background" edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 64 }}>
          <Box className="mx-auto w-full max-w-4xl gap-4 px-5 py-4">
            <Button
              accessibilityLabel="Back to Showcase home"
              onPress={onBack}
              size="sm"
              testID="dynamic-type-back"
              variant="ghost"
            >
              Back
            </Button>

            <Text testID="dynamic-type-ready" variant="heading">
              Dynamic Type fixture ready
            </Text>
            <Text testID="dynamic-type-font-scale" tone="muted">
              {`font scale: ${fontScale.toFixed(2)}`}
            </Text>

            <VStack gap="xs">
              <Text variant="label">Select (growable min-h row)</Text>
              <Select onValueChange={setPlan} value={plan}>
                <SelectTrigger accessibilityLabel="Account plan" testID="dynamic-type-select-trigger">
                  <SelectValue placeholder="Choose a plan" testID="dynamic-type-select-value" />
                </SelectTrigger>
                <SelectContent testID="dynamic-type-select-content">
                  <SelectGroup>
                    <SelectLabel>Plans</SelectLabel>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </VStack>

            <VStack gap="xs">
              <Text variant="label">Pagination (growable min-h row)</Text>
              <Pagination onPageChange={setPage} page={page} pageCount={4}>
                <PaginationItem type="previous" />
                <PaginationItem page={1} testID="dynamic-type-pagination-item-1" />
                <PaginationItem page={2} />
                <PaginationItem type="next" />
              </Pagination>
            </VStack>

            <VStack gap="xs">
              <Text variant="label">Allow-listed fixed-height exceptions</Text>
              <Button size="sm" testID="dynamic-type-save-button">
                Save changes
              </Button>
              <Field description="Used only for account notifications." label="Email">
                <Input
                  autoCapitalize="none"
                  placeholder="you@example.com"
                  testID="dynamic-type-email-input"
                />
              </Field>
            </VStack>
          </Box>
        </ScrollView>
      </SafeArea>
    </Screen>
  );
}
