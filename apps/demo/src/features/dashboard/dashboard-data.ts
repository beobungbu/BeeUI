import { demoScenarioToMockOutcome, type DemoScenario } from '../../state/demo-scenario';
import { mockFetch } from '../../services';

/**
 * Dashboard domain fixtures (#259). A support-desk operations overview: the
 * headline metrics a triage lead checks first, plus a recent-activity feed.
 * Built on the shared `mockFetch` seam (`src/services/mock-service.ts`) —
 * this file owns only its own domain shape and fixture data, per ADR-013 D5's
 * feature-isolation rule.
 */

export type ActivityStatus = 'opened' | 'resolved' | 'escalated' | 'reassigned';

export type ActivityEntry = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  status: ActivityStatus;
};

export type DashboardSummary = {
  openTickets: number;
  openTicketsDelta: number;
  resolvedToday: number;
  avgFirstResponseMinutes: number;
  slaCompliancePercent: number;
  activity: ActivityEntry[];
};

const SUMMARY_FIXTURE: DashboardSummary = {
  openTickets: 47,
  openTicketsDelta: -6,
  resolvedToday: 18,
  avgFirstResponseMinutes: 134,
  slaCompliancePercent: 92,
  activity: [
    {
      id: 'act-1',
      title: 'TCK-10482 escalated to Platform Reliability',
      detail: 'Repeated 502s reported by three enterprise accounts on the billing export endpoint.',
      meta: '12 minutes ago · Priya Natarajan',
      status: 'escalated',
    },
    {
      id: 'act-2',
      title: 'TCK-10399 resolved',
      detail: 'Password reset email deliverability restored after DNS record correction.',
      meta: '38 minutes ago · Marcus Villanueva',
      status: 'resolved',
    },
    {
      id: 'act-3',
      title: 'TCK-10475 reassigned to Billing',
      detail: 'Customer disputes a duplicate charge on invoice INV-88213; needs refund review.',
      meta: '1 hour ago · Ada Lovelace',
      status: 'reassigned',
    },
    {
      id: 'act-4',
      title: 'TCK-10501 opened',
      detail: 'Enterprise customer requests SSO metadata refresh ahead of a compliance audit.',
      meta: '2 hours ago · Grace Hopper',
      status: 'opened',
    },
  ],
};

export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

/**
 * Fetches the dashboard summary, honoring the app-wide demo scenario
 * (#263's "Demo data scenario" Settings control) so loading/empty/error are
 * reachable through real interaction, not only through tests.
 */
const EMPTY_SUMMARY: DashboardSummary = {
  openTickets: 0,
  openTicketsDelta: 0,
  resolvedToday: 0,
  avgFirstResponseMinutes: 0,
  slaCompliancePercent: 0,
  activity: [],
};

export function fetchDashboardSummary(scenario: DemoScenario): Promise<DashboardSummary> {
  return mockFetch<DashboardSummary>({
    emptyValue: EMPTY_SUMMARY,
    errorMessage: 'Could not load the dashboard summary. Check your connection and try again.',
    outcome: demoScenarioToMockOutcome(scenario),
    successValue: SUMMARY_FIXTURE,
  });
}
