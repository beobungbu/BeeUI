import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
  AppHeader,
  Badge,
  BeeUIProvider,
  Button,
  Calendar,
  Card,
  DescriptionItem,
  DescriptionList,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Field,
  HStack,
  Input,
  Screen,
  SegmentedControl,
  SegmentedControlItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
  SheetTrigger,
  Stat,
  StatLabel,
  StatValue,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useToast,
  VStack,
  type CalendarDate,
} from '@beemvp/beeui-ui';
import * as React from 'react';
import { Uniwind, useUniwind } from 'uniwind';

/**
 * R10.6 (#235) — a reference app built from AI-agent-only BeeUI context.
 *
 * "Access Requests" is a small review console for a fictional platform team.
 * It demonstrates a realistic, application-owned domain composed entirely from
 * public `@beemvp/beeui-ui` exports (BeeUI owns UI only — no router, store, or
 * data layer). It covers the pieces #235 asks for on the Web target:
 *
 *  - app shell + provider (`BeeUIProvider`, `Screen`, `AppHeader`)
 *  - theme switching (a real interaction, via Uniwind's app-level `setTheme`)
 *  - a form flow (`Field` + `Input`/`Textarea`/`Select`/`SegmentedControl`/`Switch`)
 *  - overlays (`Dialog` detail view, `AlertDialog` confirm, `Sheet` panel, `Tooltip`)
 *  - a caller-owned `Table` (BeeUI ships no data grid — ADR-007)
 *  - `Calendar` (timezone-free, single-date — ADR-008)
 *  - transient notifications (`useToast`)
 *  - `Stat`/`Badge` layout adornments
 *
 * All request/sort/selection state lives in this component, not in BeeUI.
 */

type AccessLevel = 'read' | 'write' | 'admin';
type RequestStatus = 'pending' | 'approved' | 'denied';

type AccessRequest = {
  id: string;
  requester: string;
  resource: string;
  level: AccessLevel;
  urgent: boolean;
  justification: string;
  needBy: CalendarDate | null;
  status: RequestStatus;
};

const RESOURCES = [
  { value: 'prod-db', label: 'Production database' },
  { value: 'billing', label: 'Billing dashboard' },
  { value: 'ci', label: 'CI / deploy pipeline' },
  { value: 'analytics', label: 'Analytics warehouse' },
];

const STATUS_VARIANT: Record<RequestStatus, 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  approved: 'success',
  denied: 'destructive',
};

let nextId = 3;

const SEED_REQUESTS: AccessRequest[] = [
  {
    id: '1',
    requester: 'Ada Lovelace',
    resource: 'Production database',
    level: 'read',
    urgent: false,
    justification: 'Investigating a reporting discrepancy for Q3 invoices.',
    needBy: { year: 2026, month: 9, day: 12 },
    status: 'pending',
  },
  {
    id: '2',
    requester: 'Grace Hopper',
    resource: 'CI / deploy pipeline',
    level: 'admin',
    urgent: true,
    justification: 'Rotating deploy credentials after the on-call handover.',
    needBy: { year: 2026, month: 9, day: 4 },
    status: 'approved',
  },
];

function formatCalendarDate(date: CalendarDate | null): string {
  if (!date) return 'No date set';
  // The app owns any timezone / locale formatting (ADR-008); BeeUI hands back a
  // plain { year, month, day } and never a Date with an implied zone.
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
    new Date(date.year, date.month - 1, date.day),
  );
}

function resourceLabel(value: string): string {
  return RESOURCES.find((r) => r.value === value)?.label ?? value;
}

/** App-level light/dark switch. Uniwind is the runtime theme authority; the app
 * calls `setTheme` — this is the documented app-owned path (vs. `BeeThemeScope`
 * for a single subtree). The exact API is a documentation gap — see
 * AGENT-BUILD-NOTES.md (gap G3). */
function ThemeToggle() {
  const { hasAdaptiveThemes, theme } = useUniwind();
  const active = hasAdaptiveThemes ? 'system' : theme;
  const isDark = active === 'dark';
  const next = isDark ? 'light' : 'dark';

  return (
    <Button
      accessibilityLabel={`Theme: ${active}. Switch to ${next}.`}
      onPress={() => Uniwind.setTheme(next)}
      size="sm"
      variant="outline"
    >
      {isDark ? 'Dark' : 'Light'} theme
    </Button>
  );
}

export function App() {
  const toast = useToast();
  const [requests, setRequests] = React.useState<AccessRequest[]>(SEED_REQUESTS);

  // ---- new-request form state (application-owned) ----
  const [requester, setRequester] = React.useState('');
  const [resource, setResource] = React.useState<string | undefined>(undefined);
  const [level, setLevel] = React.useState<AccessLevel>('read');
  const [urgent, setUrgent] = React.useState(false);
  const [justification, setJustification] = React.useState('');
  const [needBy, setNeedBy] = React.useState<CalendarDate | null>(null);
  const [formError, setFormError] = React.useState<string | undefined>(undefined);

  // ---- overlay state ----
  const [detail, setDetail] = React.useState<AccessRequest | null>(null);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;

  function resetForm() {
    setRequester('');
    setResource(undefined);
    setLevel('read');
    setUrgent(false);
    setJustification('');
    setNeedBy(null);
    setFormError(undefined);
  }

  function submitRequest() {
    if (requester.trim().length === 0) {
      setFormError('Enter the requester name.');
      return;
    }
    if (!resource) {
      setFormError('Choose a resource.');
      return;
    }
    const created: AccessRequest = {
      id: String(nextId++),
      requester: requester.trim(),
      resource: resourceLabel(resource),
      level,
      urgent,
      justification: justification.trim(),
      needBy,
      status: 'pending',
    };
    setRequests((prev) => [created, ...prev]);
    resetForm();
    toast.show({
      title: 'Request submitted',
      description: `${created.requester} → ${created.resource}`,
      variant: 'success',
    });
  }

  function decide(id: string, status: RequestStatus) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    toast.show({
      title: status === 'approved' ? 'Access approved' : 'Access denied',
      variant: status === 'approved' ? 'success' : 'destructive',
    });
  }

  return (
    <BeeUIProvider>
      <Screen>
        <AppHeader
          title="Access Requests"
          trailing={
            <HStack gap="sm">
              <Sheet>
                <SheetTrigger variant="outline" size="sm">
                  About
                </SheetTrigger>
                <SheetContent>
                  <SheetTitle>About this console</SheetTitle>
                  <SheetDescription>
                    A reference app assembled only from BeeUI&apos;s public component API. Approvals,
                    sorting, and all request state are owned by the app, not by BeeUI.
                  </SheetDescription>
                  <SheetFooter>
                    <SheetClose variant="outline">Close</SheetClose>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
              <ThemeToggle />
            </HStack>
          }
        />

        <div style={{ padding: 24, maxWidth: 760, margin: '0 auto', width: '100%' }}>
          <VStack gap="lg">
            <HStack gap="md">
              <Stat className="flex-1">
                <StatLabel>Total</StatLabel>
                <StatValue>{String(requests.length)}</StatValue>
              </Stat>
              <Stat className="flex-1">
                <StatLabel>Pending</StatLabel>
                <StatValue>{String(pendingCount)}</StatValue>
              </Stat>
              <Stat className="flex-1">
                <StatLabel>Approved</StatLabel>
                <StatValue>{String(approvedCount)}</StatValue>
              </Stat>
            </HStack>

            {/* ---- New request form ---- */}
            <Card padding="lg" className="gap-4">
              <Text variant="heading">New access request</Text>

              <Field label="Requester" error={formError && requester.trim() === '' ? formError : undefined}>
                <Input
                  accessibilityLabel="Requester name"
                  placeholder="Full name"
                  value={requester}
                  onChangeText={setRequester}
                />
              </Field>

              <Field label="Resource" error={formError && !resource ? formError : undefined}>
                <Select value={resource} onValueChange={setResource}>
                  <SelectTrigger accessibilityLabel="Resource">
                    <SelectValue placeholder="Select a resource" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Access level">
                <SegmentedControl
                  value={level}
                  onValueChange={(v) => setLevel(v as AccessLevel)}
                >
                  <SegmentedControlItem value="read">Read</SegmentedControlItem>
                  <SegmentedControlItem value="write">Write</SegmentedControlItem>
                  <SegmentedControlItem value="admin">Admin</SegmentedControlItem>
                </SegmentedControl>
              </Field>

              <HStack gap="sm" className="items-center justify-between">
                <HStack gap="xs" className="items-center">
                  <Text variant="label">Urgent (expedited review)</Text>
                  <Tooltip>
                    <TooltipTrigger variant="ghost" size="sm" accessibilityLabel="What does urgent mean?">
                      Why?
                    </TooltipTrigger>
                    <TooltipContent>Urgent requests are surfaced to on-call approvers first.</TooltipContent>
                  </Tooltip>
                </HStack>
                <Switch
                  accessibilityLabel="Mark request urgent"
                  value={urgent}
                  onValueChange={setUrgent}
                />
              </HStack>

              <Field label="Justification" description="Shown to the approver.">
                <Textarea
                  accessibilityLabel="Justification"
                  placeholder="Why is this access needed?"
                  value={justification}
                  onChangeText={setJustification}
                />
              </Field>

              <Field label="Needed by" description={formatCalendarDate(needBy)}>
                <Calendar
                  accessibilityLabel="Needed-by date"
                  value={needBy}
                  onValueChange={setNeedBy}
                />
              </Field>

              <HStack gap="sm">
                <Button onPress={submitRequest}>Submit request</Button>
                <Button variant="ghost" onPress={resetForm}>
                  Reset
                </Button>
              </HStack>
            </Card>

            {/* ---- Requests table (caller-owned rows/state, ADR-007) ---- */}
            <Card padding="lg" className="gap-4">
              <Text variant="heading">Queue</Text>
              <Table accessibilityLabel="Access requests">
                <TableHeader>
                  <TableRow>
                    <TableHead>Requester</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <HStack gap="xs" className="items-center">
                          <Text variant="body">{r.requester}</Text>
                          {r.urgent ? <Badge variant="destructive">Urgent</Badge> : null}
                        </HStack>
                      </TableCell>
                      <TableCell>{r.resource}</TableCell>
                      <TableCell>{r.level}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <HStack gap="xs">
                          <Button size="sm" variant="outline" onPress={() => setDetail(r)}>
                            Details
                          </Button>
                          {r.status === 'pending' ? (
                            <AlertDialog>
                              <AlertDialogTrigger size="sm">Decide</AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogTitle>Review access</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {r.requester} is requesting {r.level} access to {r.resource}.
                                </AlertDialogDescription>
                                <AlertDialogFooter>
                                  <AlertDialogCancel variant="outline">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    variant="destructive"
                                    onPress={() => decide(r.id, 'denied')}
                                  >
                                    Deny
                                  </AlertDialogAction>
                                  <AlertDialogAction onPress={() => decide(r.id, 'approved')}>
                                    Approve
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : null}
                        </HStack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </VStack>
        </div>

        {/* ---- Request detail dialog ---- */}
        <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
          <DialogContent>
            <DialogTitle>Request detail</DialogTitle>
            <DialogDescription>Read-only view of the selected request.</DialogDescription>
            {detail ? (
              <>
                <Separator />
                <DescriptionList>
                  <DescriptionItem label="Requester" value={detail.requester} />
                  <DescriptionItem label="Resource" value={detail.resource} />
                  <DescriptionItem label="Level" value={detail.level} />
                  <DescriptionItem label="Needed by" value={formatCalendarDate(detail.needBy)} />
                  <DescriptionItem label="Justification" value={detail.justification || '—'} />
                </DescriptionList>
              </>
            ) : null}
            <DialogFooter>
              <DialogClose variant="outline">Close</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Screen>
    </BeeUIProvider>
  );
}
