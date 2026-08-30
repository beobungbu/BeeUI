import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Card,
  DatePicker,
  Field,
  Input,
  SafeArea,
  Screen,
  SettingsItem,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
  SheetTrigger,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  VStack,
  useToast,
} from '@beeui/ui';
import * as React from 'react';
import { ScrollView } from 'react-native';
import {
  L10N_STRESS_PROFILE_IDS,
  L10N_STRESS_PROFILES,
  type L10nStressProfileId,
} from './l10n-stress-fixtures';

/**
 * Localization / long-content stress runtime fixture (#144, R3.6).
 *
 * One tap from Showcase home (mirrors the #143 Dynamic Type fixture's
 * navigability rule): every audited row is above the fold at the default
 * viewport, so no automation path needs to scroll to reach a target before a
 * profile switch is exercised. A profile switcher (five buttons, one per
 * `L10nStressProfileId`) re-renders the same representative row set — a
 * Tooltip, a Sheet with a primary action, a Table/DataTable row, a
 * DatePicker/Calendar field description, a form (`Field`+`Input`+`Textarea`),
 * a `SettingsItem` row, a `Toast` trigger, and navigation chrome
 * (`Breadcrumb`+`Tabs`) — with that profile's long/localized content, so a
 * single Playwright spec can assert "no viewport overflow / no clipped
 * primary action / no inaccessible truncated content" across every profile
 * without re-navigating the Component Gallery per string.
 *
 * RTL is exercised as one of the five profiles' natural directions
 * (`ar-rtl`), but this fixture does not flip `document.dir` itself — the
 * Playwright spec reuses the exact ambient-authority seam
 * `overlay-rtl-showcase.spec.ts` already established for #140/#141/#142
 * (`document.documentElement.dir = 'rtl'`), so #144 coordinates with, rather
 * than duplicates, ADR-004's direction authority.
 */
export function L10nStressAcceptance({ onBack }: { onBack: () => void }) {
  const toast = useToast();
  const [profileId, setProfileId] = React.useState<L10nStressProfileId>('long-en');
  const [dateValue, setDateValue] = React.useState<{ day: number; month: number; year: number } | null>(
    { day: 15, month: 1, year: 2026 },
  );
  const [textValue, setTextValue] = React.useState('');
  const [tab, setTab] = React.useState('overview');
  const profile = L10N_STRESS_PROFILES[profileId];

  return (
    <Screen testID="l10n-stress-screen">
      <SafeArea className="flex-1 bg-background" edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 64 }}>
          <Box className="mx-auto w-full max-w-4xl gap-4 px-5 py-4">
            <Button
              accessibilityLabel="Back to Showcase home"
              onPress={onBack}
              size="sm"
              testID="l10n-stress-back"
              variant="ghost"
            >
              Back
            </Button>

            <Text testID="l10n-stress-ready" variant="heading">
              Localization / long-content stress fixture ready
            </Text>
            <Text testID="l10n-stress-active-profile" tone="muted">
              {`profile: ${profile.id} — ${profile.label} (${profile.dir})`}
            </Text>

            <Box className="flex-row flex-wrap gap-2">
              {L10N_STRESS_PROFILE_IDS.map((id) => (
                <Button
                  accessibilityLabel={`Use ${L10N_STRESS_PROFILES[id].label} content`}
                  key={id}
                  onPress={() => setProfileId(id)}
                  size="sm"
                  testID={`l10n-stress-profile-${id}`}
                  variant={id === profileId ? 'primary' : 'outline'}
                >
                  {L10N_STRESS_PROFILES[id].label}
                </Button>
              ))}
            </Box>

            <VStack gap="xs">
              <Text variant="label">Navigation chrome (Breadcrumb + Tabs)</Text>
              <Breadcrumb accessibilityLabel="Stress breadcrumb" testID="l10n-stress-breadcrumb">
                <BreadcrumbItem onPress={() => undefined}>{profile.identifier}</BreadcrumbItem>
                <BreadcrumbItem current>{profile.longWord}</BreadcrumbItem>
              </Breadcrumb>
              <Tabs onValueChange={setTab} testID="l10n-stress-tabs" value={tab}>
                <TabsList>
                  <TabsTrigger testID="l10n-stress-tab-name" value="overview">
                    {profile.personName}
                  </TabsTrigger>
                  <TabsTrigger testID="l10n-stress-tab-details" value="details">
                    {profile.longWord}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <Text testID="l10n-stress-tab-overview-content">{profile.sentence}</Text>
                </TabsContent>
                <TabsContent value="details">
                  <Text testID="l10n-stress-tab-details-content">{profile.identifier}</Text>
                </TabsContent>
              </Tabs>
            </VStack>

            <VStack gap="xs">
              <Text variant="label">Tooltip</Text>
              <Tooltip>
                <TooltipTrigger testID="l10n-stress-tooltip-trigger" variant="outline">
                  {profile.longWord}
                </TooltipTrigger>
                <TooltipContent testID="l10n-stress-tooltip-content">{profile.sentence}</TooltipContent>
              </Tooltip>
            </VStack>

            <VStack gap="xs">
              <Text variant="label">Sheet (primary action must never clip)</Text>
              <Sheet>
                <SheetTrigger testID="l10n-stress-sheet-trigger">{profile.identifier}</SheetTrigger>
                <SheetContent overlayTestID="l10n-stress-sheet-overlay" testID="l10n-stress-sheet-content">
                  <SheetTitle testID="l10n-stress-sheet-title">{profile.personName}</SheetTitle>
                  <SheetDescription testID="l10n-stress-sheet-description">
                    {profile.sentence}
                  </SheetDescription>
                  <SheetFooter>
                    <SheetClose testID="l10n-stress-sheet-cancel" variant="outline">
                      Cancel
                    </SheetClose>
                    <Button
                      onPress={() => undefined}
                      testID="l10n-stress-primary-action"
                    >
                      {`Confirm ${profile.identifier}`}
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </VStack>

            <VStack gap="xs">
              <Text variant="label">Table / DataTable</Text>
              <Table testID="l10n-stress-table">
                <TableCaption>{profile.sentence}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Identifier</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell testID="l10n-stress-table-name">{profile.personName}</TableCell>
                    <TableCell testID="l10n-stress-table-email">{profile.email}</TableCell>
                    <TableCell testID="l10n-stress-table-id">{profile.identifier}</TableCell>
                    <TableCell testID="l10n-stress-table-amount">{profile.financeAmount}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </VStack>

            <VStack gap="xs">
              <Text variant="label">DatePicker / Calendar</Text>
              <Field description={profile.sentence} label={profile.longWord}>
                <DatePicker
                  onValueChange={setDateValue}
                  testID="l10n-stress-date-picker"
                  value={dateValue}
                />
              </Field>
            </VStack>

            <VStack gap="xs">
              <Text variant="label">Form (Field + Input + Textarea)</Text>
              <Field description={profile.sentence} label={profile.longWord}>
                <Input
                  defaultValue={profile.email}
                  testID="l10n-stress-input"
                />
              </Field>
              <Field label="Notes">
                <Textarea
                  numberOfLines={3}
                  onChangeText={setTextValue}
                  testID="l10n-stress-textarea"
                  value={textValue || profile.sentence}
                />
              </Field>
            </VStack>

            <VStack gap="xs">
              <Text variant="label">Settings row</Text>
              <Card>
                <SettingsItem
                  description={profile.sentence}
                  testID="l10n-stress-settings-item"
                  title={profile.personName}
                  value={profile.financeAmount}
                />
              </Card>
            </VStack>

            <VStack gap="xs">
              <Text variant="label">Toast</Text>
              <Button
                onPress={() =>
                  toast.show({
                    title: profile.personName,
                    description: profile.toastMessage,
                    duration: 'persistent',
                  })
                }
                testID="l10n-stress-toast-trigger"
                variant="outline"
              >
                Show toast
              </Button>
            </VStack>
          </Box>
        </ScrollView>
      </SafeArea>
    </Screen>
  );
}
