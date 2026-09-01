import {
  Badge,
  Button,
  Card,
  Checkbox,
  Chip,
  ChipGroup,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  KeyboardAwareScreen,
  Pagination,
  PaginationItem,
  SearchInput,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  VStack,
  useToast,
  type TableSortDirection,
} from '@beemvp/beeui-ui';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { useShellLayoutClass } from '../../shell/responsive-nav';
import { useAsync } from '../../services';
import { useDemoScenario } from '../../state/demo-scenario';
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
  listTickets,
  saveTicket,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from './tickets-data';

const PAGE_SIZE = 6;

const PRIORITY_BADGE_VARIANT: Record<TicketPriority, 'secondary' | 'info' | 'warning' | 'destructive'> = {
  low: 'secondary',
  medium: 'info',
  high: 'warning',
  urgent: 'destructive',
};

const STATUS_BADGE_VARIANT: Record<TicketStatus, 'primary' | 'info' | 'success' | 'secondary'> = {
  open: 'primary',
  in_progress: 'info',
  resolved: 'success',
  closed: 'secondary',
};

function matchesQuery(ticket: Ticket, query: string): boolean {
  if (!query.trim()) return true;
  const haystack = `${ticket.id} ${ticket.subject} ${ticket.requester}`.toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function nextSortDirection(current: TableSortDirection): TableSortDirection {
  if (current === 'none') return 'descending';
  if (current === 'descending') return 'ascending';
  return 'none';
}

function sortByUpdatedAt(tickets: Ticket[], direction: TableSortDirection): Ticket[] {
  if (direction === 'none') return tickets;
  const sorted = [...tickets].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return direction === 'descending' ? sorted.reverse() : sorted;
}

function RecordsTableSkeleton() {
  return (
    <VStack gap="sm" testID="records-skeleton">
      {[0, 1, 2, 3, 4].map((row) => (
        <Skeleton className="h-12 w-full" key={row} />
      ))}
    </VStack>
  );
}

export function RecordsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { scenario } = useDemoScenario();
  const layoutClass = useShellLayoutClass();
  const { data, error, retry, status } = useAsync(() => listTickets(scenario), [scenario], {
    isEmpty: (tickets) => tickets.length === 0,
  });

  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  React.useEffect(() => {
    if (status === 'success') setTickets(data);
  }, [data, status]);

  const [query, setQuery] = React.useState('');
  const [priorityFilter, setPriorityFilter] = React.useState<string[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [sortDirection, setSortDirection] = React.useState<TableSortDirection>('descending');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    const byQuery = tickets.filter((ticket) => matchesQuery(ticket, query));
    const byPriority =
      priorityFilter.length === 0 ? byQuery : byQuery.filter((ticket) => priorityFilter.includes(ticket.priority));
    const byStatus =
      statusFilter.length === 0 ? byPriority : byPriority.filter((ticket) => statusFilter.includes(ticket.status));
    return sortByUpdatedAt(byStatus, sortDirection);
  }, [tickets, query, priorityFilter, statusFilter, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const hasActiveFilters = query.trim().length > 0 || priorityFilter.length > 0 || statusFilter.length > 0;
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((ticket) => selectedIds.has(ticket.id));
  const someOnPageSelected = pageRows.some((ticket) => selectedIds.has(ticket.id)) && !allOnPageSelected;

  function clearFilters() {
    setQuery('');
    setPriorityFilter([]);
    setStatusFilter([]);
    setPage(1);
  }

  function setRowSelected(id: string, selected: boolean) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function markResolved(ticket: Ticket) {
    try {
      const updated = await saveTicket(ticket.id, { status: 'resolved' }, scenario);
      setTickets((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
      toast.show({ title: 'Ticket resolved', description: `${ticket.id} marked resolved.`, variant: 'success' });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not update the ticket.';
      toast.show({ title: 'Update failed', description: message, variant: 'destructive' });
    }
  }

  return (
    <KeyboardAwareScreen contentWidth="full">
      <VStack className="py-4" gap="md">
        <VStack gap="xs">
          <Text variant="title">Tickets</Text>
          <Text tone="muted" variant="body">
            Search, filter, and triage the support queue.
          </Text>
        </VStack>

        <SearchInput
          accessibilityLabel="Search tickets"
          onChangeText={(text) => {
            setQuery(text);
            setPage(1);
          }}
          placeholder="Search by ticket ID, subject, or requester"
          value={query}
        />

        <VStack gap="xs">
          <Text tone="muted" variant="caption">
            Priority
          </Text>
          <ChipGroup
            onValueChange={(value) => {
              setPriorityFilter(Array.isArray(value) ? value : [value]);
              setPage(1);
            }}
            selectionMode="multiple"
            value={priorityFilter}
          >
            {TICKET_PRIORITIES.map((priority) => (
              <Chip key={priority} value={priority}>
                {TICKET_PRIORITY_LABEL[priority]}
              </Chip>
            ))}
          </ChipGroup>
        </VStack>

        <VStack gap="xs">
          <Text tone="muted" variant="caption">
            Status
          </Text>
          <ChipGroup
            onValueChange={(value) => {
              setStatusFilter(Array.isArray(value) ? value : [value]);
              setPage(1);
            }}
            selectionMode="multiple"
            value={statusFilter}
          >
            {TICKET_STATUSES.map((ticketStatus) => (
              <Chip key={ticketStatus} value={ticketStatus}>
                {TICKET_STATUS_LABEL[ticketStatus]}
              </Chip>
            ))}
          </ChipGroup>
        </VStack>

        {status === 'loading' || status === 'idle' ? (
          <RecordsTableSkeleton />
        ) : status === 'error' ? (
          <Card variant="outlined">
            <ErrorState action={<Button onPress={retry}>Try again</Button>} description={error.message} testID="records-error-state" />
          </Card>
        ) : status === 'empty' ? (
          <Card variant="outlined">
            <EmptyState description="No tickets have been created yet." testID="records-empty-state" title="No tickets yet" />
          </Card>
        ) : filtered.length === 0 ? (
          <Card variant="outlined">
            <EmptyState
              action={hasActiveFilters ? <Button onPress={clearFilters}>Clear filters</Button> : undefined}
              description="Try a different search term or clear your filters."
              testID="records-no-results-state"
              title="No matching tickets"
            />
          </Card>
        ) : (
          <>
            {selectedIds.size > 0 ? (
              <Text testID="records-selection-count" tone="muted" variant="caption">
                {`${selectedIds.size} selected`}
              </Text>
            ) : null}
            <Table layout={layoutClass === 'compact' ? 'stacked' : 'scroll'} testID="records-table">
              <TableCaption>{`${filtered.length} ticket${filtered.length === 1 ? '' : 's'}`}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead label="Select all">
                    <Checkbox
                      accessibilityLabel="Select all tickets on this page"
                      checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                      onCheckedChange={(checked) =>
                        setSelectedIds((previous) => {
                          const next = new Set(previous);
                          pageRows.forEach((ticket) => {
                            if (checked) next.add(ticket.id);
                            else next.delete(ticket.id);
                          });
                          return next;
                        })
                      }
                    />
                  </TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead
                    onSortChange={() => setSortDirection(nextSortDirection(sortDirection))}
                    sortDirection={sortDirection}
                  >
                    Updated
                  </TableHead>
                  <TableHead label="Actions">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((ticket) => (
                  <TableRow key={ticket.id} selected={selectedIds.has(ticket.id)}>
                    <TableCell label="Select">
                      <Checkbox
                        accessibilityLabel={`Select ${ticket.id}`}
                        checked={selectedIds.has(ticket.id)}
                        onCheckedChange={(checked) => setRowSelected(ticket.id, checked)}
                      />
                    </TableCell>
                    <TableCell label="Ticket">
                      <Button
                        accessibilityLabel={`Open ${ticket.id}: ${ticket.subject}`}
                        className="justify-start px-0"
                        onPress={() => router.push(`/records/${ticket.id}`)}
                        variant="ghost"
                      >
                        <VStack className="items-start" gap="none">
                          <Text numberOfLines={2} variant="label">
                            {ticket.subject}
                          </Text>
                          <Text tone="subtle" variant="caption">
                            {ticket.id}
                          </Text>
                        </VStack>
                      </Button>
                    </TableCell>
                    <TableCell label="Requester">{ticket.requester}</TableCell>
                    <TableCell label="Priority">
                      <Badge variant={PRIORITY_BADGE_VARIANT[ticket.priority]}>
                        {TICKET_PRIORITY_LABEL[ticket.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell label="Status">
                      <Badge variant={STATUS_BADGE_VARIANT[ticket.status]}>{TICKET_STATUS_LABEL[ticket.status]}</Badge>
                    </TableCell>
                    <TableCell label="Updated">{ticket.updatedAt}</TableCell>
                    <TableCell label="Actions">
                      <DropdownMenu>
                        <DropdownMenuTrigger accessibilityLabel={`Actions for ${ticket.id}`} variant="outline">
                          Actions
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => router.push(`/records/${ticket.id}`)}>
                            Open ticket
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={ticket.status === 'resolved'} onSelect={() => markResolved(ticket)}>
                            Mark resolved
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {pageCount > 1 ? (
              <Pagination onPageChange={setPage} page={clampedPage} pageCount={pageCount}>
                <PaginationItem type="previous" />
                {Array.from({ length: pageCount }, (_, index) => (
                  <PaginationItem key={index + 1} page={index + 1} />
                ))}
                <PaginationItem type="next" />
              </Pagination>
            ) : null}
          </>
        )}
      </VStack>
    </KeyboardAwareScreen>
  );
}
