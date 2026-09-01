// Pure, app-owned query helpers: search + filter + sort + paginate.
//
// ADR-007 is explicit that Table stores no query/sort/filter/selection state
// and ships no data-grid. All of that lives here, in the application, and the
// screen passes only the derived rows to `Table`. These are pure functions so
// they can be unit-tested without rendering (per ADR-013 D7's Table
// search/filter/sort test guidance).

import type { DirectoryRecord, RecordRole, RecordStatus } from './records-data';

export type SortColumn = 'name' | 'joinedAt';
export type SortDirection = 'ascending' | 'descending';

export type RecordsQuery = {
  search: string;
  roles: RecordRole[]; // empty = all roles
  status: RecordStatus | 'all';
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  page: number; // 1-based
  pageSize: number;
};

export const DEFAULT_QUERY: RecordsQuery = {
  search: '',
  roles: [],
  status: 'all',
  sortColumn: 'name',
  sortDirection: 'ascending',
  page: 1,
  pageSize: 8,
};

function matchesSearch(record: DirectoryRecord, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return (
    record.name.toLowerCase().includes(needle) || record.email.toLowerCase().includes(needle)
  );
}

export function filterRecords(records: DirectoryRecord[], query: RecordsQuery): DirectoryRecord[] {
  return records.filter((record) => {
    if (!matchesSearch(record, query.search)) return false;
    if (query.roles.length > 0 && !query.roles.includes(record.role)) return false;
    if (query.status !== 'all' && record.status !== query.status) return false;
    return true;
  });
}

export function sortRecords(records: DirectoryRecord[], query: RecordsQuery): DirectoryRecord[] {
  const factor = query.sortDirection === 'ascending' ? 1 : -1;
  return [...records].sort((a, b) => {
    const av = a[query.sortColumn];
    const bv = b[query.sortColumn];
    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    return 0;
  });
}

export type PagedResult = {
  rows: DirectoryRecord[];
  page: number;
  pageCount: number;
  total: number;
};

export function paginateRecords(records: DirectoryRecord[], query: RecordsQuery): PagedResult {
  const total = records.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * query.pageSize;
  return {
    rows: records.slice(start, start + query.pageSize),
    page,
    pageCount,
    total,
  };
}

/** Full pipeline: filter → sort → paginate. Returns the page plus the filtered total. */
export function runQuery(
  records: DirectoryRecord[],
  query: RecordsQuery,
): PagedResult & { filteredTotal: number } {
  const filtered = filterRecords(records, query);
  const sorted = sortRecords(filtered, query);
  const paged = paginateRecords(sorted, query);
  return { ...paged, filteredTotal: filtered.length };
}
