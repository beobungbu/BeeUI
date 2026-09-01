import {
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  ChipGroup,
  type ChipGroupValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  HStack,
  Pagination,
  PaginationItem,
  Screen,
  SearchInput,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  type TableSortDirection,
  Text,
  useToast,
  VStack,
} from '@beemvp/beeui-ui';
import * as React from 'react';

import {
  DIRECTORY_RECORDS,
  ROLE_LABELS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  type DirectoryRecord,
  type RecordRole,
  type RecordStatus,
} from './records-data';
import { listRecords, type DataScenario } from './records-service';
import {
  DEFAULT_QUERY,
  runQuery,
  type RecordsQuery,
  type SortColumn,
} from './records-query';
import { useAsync } from './use-async';

const ROLE_OPTIONS: RecordRole[] = ['admin', 'editor', 'viewer'];
const STATUS_OPTIONS: (RecordStatus | 'all')[] = ['all', 'active', 'invited', 'suspended'];

function formatJoined(iso: string): string {
  // App owns date formatting (ADR-008): parse the date-only value as UTC so it
  // never drifts a day across the viewer's timezone.
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Map the app's active-column + direction onto a `TableHead`'s controlled prop. */
function headSort(query: RecordsQuery, column: SortColumn): TableSortDirection {
  return query.sortColumn === column ? query.sortDirection : 'none';
}

export function RecordsScreen() {
  const toast = useToast();

  // --- Data scenario (dev affordance to exercise loading/empty/error states). ---
  const [scenario, setScenario] = React.useState<DataScenario>('ok');
  const loader = React.useCallback(() => listRecords(scenario), [scenario]);
  const records = useAsync(loader);

  // --- Caller-owned query + selection state (ADR-007 D2). ---
  const [query, setQuery] = React.useState<RecordsQuery>(DEFAULT_QUERY);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(() => new Set());

  const patchQuery = React.useCallback((patch: Partial<RecordsQuery>) => {
    // Any filter/search/sort change resets to page 1.
    setQuery((prev) => ({ ...prev, page: 1, ...patch }));
  }, []);

  const toggleSort = React.useCallback((column: SortColumn) => {
    setQuery((prev) => {
      if (prev.sortColumn !== column) {
        return { ...prev, sortColumn: column, sortDirection: 'ascending', page: 1 };
      }
      return {
        ...prev,
        sortDirection: prev.sortDirection === 'ascending' ? 'descending' : 'ascending',
      };
    });
  }, []);

  const source: DirectoryRecord[] = records.status === 'success' ? records.data : [];
  const result = React.useMemo(() => runQuery(source, query), [source, query]);

  const pageIds = result.rows.map((r) => r.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id));
  const allPageSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const somePageSelected = selectedOnPage.length > 0 && !allPageSelected;

  const toggleRow = React.useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleAllOnPage = React.useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of pageIds) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [pageIds],
  );

  const runRowAction = React.useCallback(
    (record: DirectoryRecord, action: string) => {
      toast.show({
        title: `${action}: ${record.name}`,
        description: record.email,
        variant: action === 'Suspend' ? 'warning' : 'info',
      });
    },
    [toast],
  );

  const columnCount = 6; // select, name, email, role, status, joined, actions => spanning cell width

  return (
    <Screen padding="md">
      <VStack gap="lg">
        <Text variant="title">Directory records</Text>

        {/* --- Toolbar: search + role chips + status segmented control --- */}
        <VStack gap="md">
          <SearchInput
            accessibilityLabel="Search records"
            placeholder="Search by name or email"
            value={query.search}
            onChangeText={(text) => patchQuery({ search: text })}
          />

          <HStack gap="sm" align="center" wrap>
            <Text variant="label" tone="muted">
              Role
            </Text>
            <ChipGroup
              selectionMode="multiple"
              value={query.roles}
              onValueChange={(value: ChipGroupValue) =>
                patchQuery({ roles: (Array.isArray(value) ? value : [value]) as RecordRole[] })
              }
            >
              {ROLE_OPTIONS.map((role) => (
                <Chip key={role} value={role}>
                  {ROLE_LABELS[role]}
                </Chip>
              ))}
            </ChipGroup>
          </HStack>

          <SegmentedControl
            value={query.status}
            onValueChange={(value) => patchQuery({ status: value as RecordsQuery['status'] })}
          >
            {STATUS_OPTIONS.map((status) => (
              <SegmentedControlItem key={status} value={status}>
                {status === 'all' ? 'All' : STATUS_LABELS[status]}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </VStack>

        {/* --- Body: one of loading / error / empty / no-results / table --- */}
        {records.status === 'loading' ? (
          <LoadingRows />
        ) : records.status === 'error' ? (
          <ErrorState
            title="Couldn't load records"
            description={records.error.message}
            action={
              <Button variant="outline" onPress={records.reload}>
                Retry
              </Button>
            }
          />
        ) : result.total === 0 ? (
          <EmptyState
            title="No records yet"
            description="Records will appear here once the directory has members."
          />
        ) : result.filteredTotal === 0 ? (
          <EmptyState
            title="No matching records"
            description="No records match your search and filters."
            action={
              <Button variant="outline" onPress={() => setQuery(DEFAULT_QUERY)}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <Table>
            <TableCaption>
              {result.filteredTotal} of {result.total} records
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead label="Select">
                  <Checkbox
                    accessibilityLabel="Select all rows on this page"
                    checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAllOnPage}
                  />
                </TableHead>
                <TableHead
                  sortDirection={headSort(query, 'name')}
                  onSortChange={() => toggleSort('name')}
                >
                  Name
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead
                  sortDirection={headSort(query, 'joinedAt')}
                  onSortChange={() => toggleSort('joinedAt')}
                >
                  Joined
                </TableHead>
                <TableHead label="Actions">
                  <Text variant="label" tone="muted">
                    Actions
                  </Text>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((record) => {
                const isSelected = selected.has(record.id);
                return (
                  <TableRow key={record.id} selected={isSelected}>
                    <TableCell label="Select">
                      <Checkbox
                        accessibilityLabel={`Select ${record.name}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => toggleRow(record.id, checked)}
                      />
                    </TableCell>
                    <TableCell label="Name">
                      <Text variant="label">{record.name}</Text>
                    </TableCell>
                    <TableCell label="Email">
                      <Text tone="muted">{record.email}</Text>
                    </TableCell>
                    <TableCell label="Role">{ROLE_LABELS[record.role]}</TableCell>
                    <TableCell label="Status">
                      <Badge variant={STATUS_BADGE_VARIANT[record.status]}>
                        {STATUS_LABELS[record.status]}
                      </Badge>
                    </TableCell>
                    <TableCell label="Joined">
                      <Text numeric="tabular">{formatJoined(record.joinedAt)}</Text>
                    </TableCell>
                    <TableCell label="Actions">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          variant="ghost"
                          size="sm"
                          accessibilityLabel={`Actions for ${record.name}`}
                        >
                          Actions
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => runRowAction(record, 'View')}>
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => runRowAction(record, 'Edit')}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => runRowAction(record, 'Suspend')}>
                            Suspend
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={columnCount + 1}>
                  <HStack justify="between" align="center" wrap gap="md">
                    <Text tone="muted">
                      {selected.size} selected · page {result.page} of {result.pageCount}
                    </Text>
                    <Pagination
                      page={result.page}
                      pageCount={result.pageCount}
                      onPageChange={(page) => setQuery((prev) => ({ ...prev, page }))}
                    >
                      <PaginationItem type="previous" />
                      {Array.from({ length: result.pageCount }, (_, i) => (
                        <PaginationItem key={i} page={i + 1} />
                      ))}
                      <PaginationItem type="next" />
                    </Pagination>
                  </HStack>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}

        {/* --- Dev-only: exercise the service seam's data scenarios --- */}
        <Box className="border-t border-border pt-4">
          <HStack gap="sm" align="center" wrap>
            <Text variant="label" tone="muted">
              Data scenario
            </Text>
            {(['ok', 'empty', 'error'] as DataScenario[]).map((s) => (
              <Button
                key={s}
                variant={scenario === s ? 'primary' : 'outline'}
                size="sm"
                onPress={() => {
                  setScenario(s);
                  setSelected(new Set());
                }}
              >
                {s}
              </Button>
            ))}
          </HStack>
        </Box>
      </VStack>
    </Screen>
  );
}

function LoadingRows() {
  return (
    <VStack gap="sm" accessibilityLabel="Loading records">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md" />
      ))}
    </VStack>
  );
}

// Referenced so the fixture module is part of the type graph even if a future
// edit swaps the service seam for a direct import.
export const RECORD_COUNT = DIRECTORY_RECORDS.length;
