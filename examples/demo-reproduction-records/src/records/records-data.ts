// Application-owned domain model + in-memory fixtures for the records flow.
//
// Per ADR-013 D4 and ADR-007's state-boundary decision, BeeUI owns none of
// this: the data shape, the fixtures, and every derived list are the
// application's, not `@beemvp/beeui-ui`'s. BeeUI only renders what this app maps
// onto `Table*` / `Badge` / etc.

export type RecordStatus = 'active' | 'invited' | 'suspended';
export type RecordRole = 'admin' | 'editor' | 'viewer';

export type DirectoryRecord = {
  id: string;
  name: string;
  email: string;
  role: RecordRole;
  status: RecordStatus;
  /** ISO date-only string (YYYY-MM-DD). App owns any timezone handling (ADR-008). */
  joinedAt: string;
};

export const ROLE_LABELS: Record<RecordRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

export const STATUS_LABELS: Record<RecordStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
};

// Semantic Badge variant per status (semantic tokens only — no literal colors).
export const STATUS_BADGE_VARIANT: Record<RecordStatus, 'success' | 'info' | 'destructive'> = {
  active: 'success',
  invited: 'info',
  suspended: 'destructive',
};

export const DIRECTORY_RECORDS: DirectoryRecord[] = [
  { id: 'r-001', name: 'Amara Okafor', email: 'amara.okafor@example.com', role: 'admin', status: 'active', joinedAt: '2023-01-14' },
  { id: 'r-002', name: 'Bennett Cho', email: 'bennett.cho@example.com', role: 'editor', status: 'active', joinedAt: '2023-02-03' },
  { id: 'r-003', name: 'Priya Nair', email: 'priya.nair@example.com', role: 'viewer', status: 'invited', joinedAt: '2023-02-19' },
  { id: 'r-004', name: 'Dmitri Volkov', email: 'dmitri.volkov@example.com', role: 'editor', status: 'suspended', joinedAt: '2023-03-08' },
  { id: 'r-005', name: 'Sofia Marino', email: 'sofia.marino@example.com', role: 'viewer', status: 'active', joinedAt: '2023-03-27' },
  { id: 'r-006', name: 'Kwame Mensah', email: 'kwame.mensah@example.com', role: 'admin', status: 'active', joinedAt: '2023-04-11' },
  { id: 'r-007', name: 'Lena Fischer', email: 'lena.fischer@example.com', role: 'viewer', status: 'invited', joinedAt: '2023-05-02' },
  { id: 'r-008', name: 'Hiroshi Tanaka', email: 'hiroshi.tanaka@example.com', role: 'editor', status: 'active', joinedAt: '2023-05-21' },
  { id: 'r-009', name: 'Isabela Cruz', email: 'isabela.cruz@example.com', role: 'viewer', status: 'suspended', joinedAt: '2023-06-09' },
  { id: 'r-010', name: 'Omar Haddad', email: 'omar.haddad@example.com', role: 'editor', status: 'active', joinedAt: '2023-06-30' },
  { id: 'r-011', name: 'Grace Liu', email: 'grace.liu@example.com', role: 'admin', status: 'invited', joinedAt: '2023-07-18' },
  { id: 'r-012', name: 'Noah Bergström', email: 'noah.bergstrom@example.com', role: 'viewer', status: 'active', joinedAt: '2023-08-06' },
  { id: 'r-013', name: 'Fatima Zahra', email: 'fatima.zahra@example.com', role: 'editor', status: 'active', joinedAt: '2023-08-25' },
  { id: 'r-014', name: 'Elias Novak', email: 'elias.novak@example.com', role: 'viewer', status: 'invited', joinedAt: '2023-09-13' },
  { id: 'r-015', name: 'Yara Costa', email: 'yara.costa@example.com', role: 'admin', status: 'active', joinedAt: '2023-10-01' },
  { id: 'r-016', name: 'Tomas Rivera', email: 'tomas.rivera@example.com', role: 'editor', status: 'suspended', joinedAt: '2023-10-20' },
  { id: 'r-017', name: 'Anika Sharma', email: 'anika.sharma@example.com', role: 'viewer', status: 'active', joinedAt: '2023-11-08' },
  { id: 'r-018', name: 'Marco Bianchi', email: 'marco.bianchi@example.com', role: 'editor', status: 'invited', joinedAt: '2023-11-27' },
  { id: 'r-019', name: 'Chloé Dubois', email: 'chloe.dubois@example.com', role: 'viewer', status: 'active', joinedAt: '2023-12-15' },
  { id: 'r-020', name: 'Rafael Santos', email: 'rafael.santos@example.com', role: 'admin', status: 'active', joinedAt: '2024-01-04' },
  { id: 'r-021', name: 'Ingrid Larsen', email: 'ingrid.larsen@example.com', role: 'editor', status: 'active', joinedAt: '2024-01-23' },
  { id: 'r-022', name: 'Samuel Adeyemi', email: 'samuel.adeyemi@example.com', role: 'viewer', status: 'invited', joinedAt: '2024-02-10' },
  { id: 'r-023', name: 'Wei Chen', email: 'wei.chen@example.com', role: 'editor', status: 'active', joinedAt: '2024-02-29' },
  { id: 'r-024', name: 'Nadia Petrova', email: 'nadia.petrova@example.com', role: 'viewer', status: 'suspended', joinedAt: '2024-03-18' },
];
