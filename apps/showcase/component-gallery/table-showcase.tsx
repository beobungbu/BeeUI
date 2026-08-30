import {
  Badge,
  Card,
  Checkbox,
  IconButton,
  Section,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  VStack,
  type TableSortDirection,
} from '@beeui/ui';
import * as React from 'react';

type TeamMember = {
  id: string;
  name: string;
  role: string;
  status: 'Active' | 'Invited';
};

const TEAM_MEMBERS: TeamMember[] = [
  { id: 'ada', name: 'Ada Lovelace', role: 'Engineering', status: 'Active' },
  { id: 'grace', name: 'Grace Hopper', role: 'Engineering', status: 'Active' },
  { id: 'alan', name: 'Alan Turing', role: 'Research', status: 'Invited' },
];

// Real, caller-owned sort — proves `TableHead`'s `sortDirection`/`onSortChange`
// contract drives actual row order rather than a purely decorative indicator
// (ADR-007 "State boundaries": Table stores no sort state itself).
function sortByName(rows: TeamMember[], direction: TableSortDirection): TeamMember[] {
  if (direction === 'none') return rows;
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  return direction === 'descending' ? sorted.reverse() : sorted;
}

function nextSortDirection(current: TableSortDirection): TableSortDirection {
  if (current === 'none') return 'ascending';
  if (current === 'ascending') return 'descending';
  return 'none';
}

function TeamTable({ layout }: { layout?: 'scroll' | 'stacked' }) {
  const [sortDirection, setSortDirection] = React.useState<TableSortDirection>('none');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const rows = React.useMemo(() => sortByName(TEAM_MEMBERS, sortDirection), [sortDirection]);
  const allSelected = selectedIds.size === TEAM_MEMBERS.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const setRowSelected = (id: string, selected: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <VStack gap="sm">
      <Table layout={layout}>
        <TableCaption>Team members</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead label="Select all">
              <Checkbox
                accessibilityLabel="Select all team members"
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={(checked) =>
                  setSelectedIds(checked ? new Set(TEAM_MEMBERS.map((member) => member.id)) : new Set())
                }
              />
            </TableHead>
            <TableHead onSortChange={() => setSortDirection(nextSortDirection(sortDirection))} sortDirection={sortDirection}>
              Name
            </TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead label="Actions">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((member) => (
            <TableRow key={member.id} selected={selectedIds.has(member.id)}>
              <TableCell label="Select">
                <Checkbox
                  accessibilityLabel={`Select ${member.name}`}
                  checked={selectedIds.has(member.id)}
                  onCheckedChange={(checked) => setRowSelected(member.id, checked)}
                />
              </TableCell>
              <TableCell>{member.name}</TableCell>
              <TableCell>{member.role}</TableCell>
              <TableCell>
                <Badge variant={member.status === 'Active' ? 'success' : 'secondary'}>
                  {member.status}
                </Badge>
              </TableCell>
              <TableCell label="Actions">
                <IconButton accessibilityLabel={`Edit ${member.name}`} variant="ghost">
                  ✎
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Text tone="muted" variant="caption">
        {`Sort: ${sortDirection} · Selected: ${selectedIds.size}`}
      </Text>
    </VStack>
  );
}

export function TableShowcase() {
  return (
    <VStack gap="lg">
      <Card className="gap-4" testID="table-showcase" variant="raised">
        <Section
          description="Real HTML table/th-scope semantics, a keyboard-reachable sort trigger in normal tab order, and caller-owned row selection via Checkbox (ADR-007)."
          title="Sortable, selectable table"
        >
          <TeamTable />
        </Section>
      </Card>

      <Card className="gap-4" testID="table-showcase-stacked">
        <Section
          description="Explicit opt-in card/label-value presentation for narrow viewports — the same composed rows, no duplicated `.map()` loop."
          title="Stacked layout"
        >
          <TeamTable layout="stacked" />
        </Section>
      </Card>
    </VStack>
  );
}
