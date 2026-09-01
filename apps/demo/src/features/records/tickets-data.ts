import { demoScenarioToMockOutcome, type DemoScenario } from '../../state/demo-scenario';
import { mockFetch } from '../../services';

/**
 * The "tickets" entity (#260 records + #261 detail/edit share this shape — a
 * ticket viewed in the table is the same ticket opened for detail/edit).
 * Fixtures include representative long subjects/requester names and a wide
 * id/priority/status spread so search, filter, sort, and narrow-viewport
 * wrapping all have something real to exercise.
 */

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type Ticket = {
  id: string;
  subject: string;
  requester: string;
  assignee: string;
  priority: TicketPriority;
  status: TicketStatus;
  updatedAt: string;
  description: string;
};

export const TICKET_PRIORITIES: readonly TicketPriority[] = ['low', 'medium', 'high', 'urgent'];
export const TICKET_STATUSES: readonly TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const TICKETS: Ticket[] = [
  {
    id: 'TCK-10482',
    subject: 'Repeated 502s on the billing export endpoint for enterprise accounts',
    requester: 'Priya Natarajan',
    assignee: 'Grace Hopper',
    priority: 'urgent',
    status: 'open',
    updatedAt: '2026-08-31',
    description:
      'Three enterprise accounts report intermittent 502 Bad Gateway responses when exporting monthly billing statements larger than 50 MB. Suspected upstream timeout on the export worker pool.',
  },
  {
    id: 'TCK-10475',
    subject: 'Customer disputes a duplicate charge on invoice INV-88213',
    requester: 'Diego Fernandez-Villalobos',
    assignee: 'Ada Lovelace',
    priority: 'high',
    status: 'in_progress',
    updatedAt: '2026-08-31',
    description:
      'Customer was charged twice for the September annual plan renewal. Refund of the duplicate charge is pending finance approval.',
  },
  {
    id: 'TCK-10461',
    subject: 'Feature request: bulk CSV import for the contacts directory',
    requester: 'Wei Zhang',
    assignee: 'Alan Turing',
    priority: 'low',
    status: 'open',
    updatedAt: '2026-08-30',
    description: 'Customer wants to import 12,000 contacts at once instead of one at a time via the UI.',
  },
  {
    id: 'TCK-10453',
    subject: 'Two-factor authentication codes arrive several minutes late over SMS',
    requester: 'Fatima Al-Sayed',
    assignee: 'Grace Hopper',
    priority: 'high',
    status: 'open',
    updatedAt: '2026-08-30',
    description: 'SMS delivery delay is causing login codes to expire before the customer can enter them.',
  },
  {
    id: 'TCK-10441',
    subject: 'Dashboard chart tooltips overlap on narrow browser windows',
    requester: 'Marcus Villanueva',
    assignee: 'Ada Lovelace',
    priority: 'medium',
    status: 'resolved',
    updatedAt: '2026-08-29',
    description: 'Tooltip positioning fix shipped in the 2026.34 release; awaiting customer confirmation.',
  },
  {
    id: 'TCK-10430',
    subject: 'Enterprise SSO metadata refresh needed ahead of compliance audit',
    requester: 'Grace Hopper',
    assignee: 'Alan Turing',
    priority: 'urgent',
    status: 'in_progress',
    updatedAt: '2026-08-29',
    description: 'Customer needs updated SAML metadata before their annual SOC 2 audit next week.',
  },
  {
    id: 'TCK-10418',
    subject: 'Password reset email deliverability restored after DNS correction',
    requester: 'Marcus Villanueva',
    assignee: 'Ada Lovelace',
    priority: 'medium',
    status: 'closed',
    updatedAt: '2026-08-28',
    description: 'Corrected SPF/DKIM records for the transactional mail domain; deliverability confirmed.',
  },
  {
    id: 'TCK-10402',
    subject: 'Mobile app crashes when rotating device during onboarding survey',
    requester: 'Aiko Tanaka',
    assignee: 'Alan Turing',
    priority: 'medium',
    status: 'open',
    updatedAt: '2026-08-27',
    description: 'Repro: start onboarding survey on iOS, rotate to landscape on question 3, app crashes.',
  },
  {
    id: 'TCK-10399',
    subject: 'Requesting an itemized export of Q2 API usage for a cost review',
    requester: 'Ola Nordmann',
    assignee: 'Grace Hopper',
    priority: 'low',
    status: 'closed',
    updatedAt: '2026-08-26',
    description: 'Finance team wants a per-endpoint breakdown of API calls for the second quarter.',
  },
  {
    id: 'TCK-10387',
    subject: 'Webhook retries are not honoring the configured exponential backoff',
    requester: 'Sofia Kowalska',
    assignee: 'Ada Lovelace',
    priority: 'high',
    status: 'in_progress',
    updatedAt: '2026-08-25',
    description: 'Webhook delivery retries every 5 seconds regardless of the backoff configuration.',
  },
  {
    id: 'TCK-10373',
    subject: 'Team wants a read-only role that can view but not edit billing settings',
    requester: 'Chinedu Okafor',
    assignee: 'Grace Hopper',
    priority: 'low',
    status: 'open',
    updatedAt: '2026-08-24',
    description: 'Currently every admin can edit billing; customer wants a lower-privilege viewer role.',
  },
  {
    id: 'TCK-10360',
    subject: 'Search results ignore accented characters in customer names',
    requester: 'Amelie Dubois',
    assignee: 'Alan Turing',
    priority: 'medium',
    status: 'resolved',
    updatedAt: '2026-08-23',
    description: 'Searching "Amelie" does not match a record stored as "Amélie" until normalization ships.',
  },
];

export function getAllTickets(): Ticket[] {
  return TICKETS;
}

export function getTicketById(id: string): Ticket | undefined {
  return TICKETS.find((ticket) => ticket.id === id);
}

/** Applies an in-place field update and returns the updated ticket (mock persistence). */
export function updateTicketFixture(id: string, patch: Partial<Omit<Ticket, 'id'>>): Ticket | undefined {
  const index = TICKETS.findIndex((ticket) => ticket.id === id);
  if (index === -1) return undefined;
  TICKETS[index] = { ...TICKETS[index], ...patch };
  return TICKETS[index];
}

export function listTickets(scenario: DemoScenario): Promise<Ticket[]> {
  return mockFetch<Ticket[]>({
    emptyValue: [],
    errorMessage: 'Could not load tickets. Check your connection and try again.',
    outcome: demoScenarioToMockOutcome(scenario),
    successValue: getAllTickets(),
  });
}

export function getTicket(id: string, scenario: DemoScenario): Promise<Ticket | null> {
  return mockFetch<Ticket | null>({
    // "empty" has no natural meaning for a single-entity fetch, so it is
    // reused to represent "not found" — the one legitimately empty outcome a
    // detail screen can show (ADR-013 D4's fixtures/flags are defined per
    // feature; this is this feature's own honest mapping).
    emptyValue: null,
    errorMessage: `Could not load ticket ${id}. Check your connection and try again.`,
    outcome: demoScenarioToMockOutcome(scenario),
    successValue: getTicketById(id) ?? null,
  });
}

export function saveTicket(
  id: string,
  patch: Partial<Omit<Ticket, 'id'>>,
  scenario: DemoScenario,
): Promise<Ticket> {
  const existing = getTicketById(id);
  if (!existing) {
    return Promise.reject(new Error(`Cannot save ticket ${id}: it does not exist.`));
  }

  return mockFetch<Ticket>({
    emptyValue: existing,
    errorMessage: `Could not save ticket ${id}. Check your connection and try again.`,
    // "empty" has no meaning for a save action — only "error" should fail a save.
    outcome: scenario === 'error' ? 'error' : 'success',
    successValue: updateTicketFixture(id, patch) ?? existing,
  });
}
