import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  KeyboardAwareScreen,
  Progress,
  Section,
  Separator,
  Skeleton,
  Stat,
  StatHelpText,
  StatLabel,
  StatValue,
  Text,
  Timeline,
  TimelineItem,
  VStack,
  type TimelineItemProps,
} from '@beemvp/beeui-ui';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { useDemoScenario } from '../../state/demo-scenario';
import { useAsync } from '../../services';
import { fetchDashboardSummary, formatMinutes, type ActivityStatus } from './dashboard-data';

const ACTIVITY_STATUS_TONE: Record<ActivityStatus, TimelineItemProps['status']> = {
  opened: 'default',
  resolved: 'success',
  escalated: 'destructive',
  reassigned: 'primary',
};

function SummarySkeleton() {
  return (
    <Card className="gap-4" variant="raised">
      <VStack gap="md">
        {[0, 1, 2, 3].map((index) => (
          <VStack gap="xs" key={index}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
          </VStack>
        ))}
      </VStack>
    </Card>
  );
}

export function DashboardScreen() {
  const router = useRouter();
  const { scenario } = useDemoScenario();
  const { data, error, retry, status } = useAsync(
    () => fetchDashboardSummary(scenario),
    [scenario],
    { isEmpty: (summary) => summary.openTickets === 0 && summary.activity.length === 0 },
  );

  return (
    <KeyboardAwareScreen contentWidth="lg">
      <VStack className="py-4" gap="lg">
        <VStack gap="xs">
          <Text variant="title">Good afternoon, Ada</Text>
          <Text tone="muted" variant="body">
            Here is how the support desk is trending right now.
          </Text>
        </VStack>

        {status === 'loading' || status === 'idle' ? (
          <SummarySkeleton />
        ) : status === 'error' ? (
          <Card variant="outlined">
            <ErrorState
              action={<Button onPress={retry}>Try again</Button>}
              description={error.message}
              testID="dashboard-error-state"
            />
          </Card>
        ) : status === 'empty' ? (
          <Card variant="outlined">
            <EmptyState
              description="No ticket activity has been recorded yet for this workspace."
              testID="dashboard-empty-state"
              title="Nothing to show yet"
            />
          </Card>
        ) : (
          <>
            <Card className="gap-5" testID="dashboard-summary" variant="raised">
              <VStack className="flex-row flex-wrap" gap="lg">
                <Stat className="min-w-[45%] flex-1">
                  <StatLabel>Open tickets</StatLabel>
                  <StatValue>{data.openTickets}</StatValue>
                  <StatHelpText tone={data.openTicketsDelta <= 0 ? 'success' : 'destructive'}>
                    {data.openTicketsDelta <= 0
                      ? `${Math.abs(data.openTicketsDelta)} fewer than yesterday`
                      : `${data.openTicketsDelta} more than yesterday`}
                  </StatHelpText>
                </Stat>
                <Stat className="min-w-[45%] flex-1">
                  <StatLabel>Resolved today</StatLabel>
                  <StatValue>{data.resolvedToday}</StatValue>
                  <StatHelpText>Across all queues</StatHelpText>
                </Stat>
                <Stat className="min-w-[45%] flex-1">
                  <StatLabel>Avg. first response</StatLabel>
                  <StatValue>{formatMinutes(data.avgFirstResponseMinutes)}</StatValue>
                  <StatHelpText>Rolling 24 hours</StatHelpText>
                </Stat>
                <Stat className="min-w-[45%] flex-1">
                  <StatLabel>SLA compliance</StatLabel>
                  <StatValue>{data.slaCompliancePercent}%</StatValue>
                  <Progress
                    accessibilityLabel="SLA compliance"
                    className="mt-1"
                    size="sm"
                    value={data.slaCompliancePercent}
                  />
                </Stat>
              </VStack>
            </Card>

            <Card variant="raised">
              <Section
                action={
                  <Button onPress={() => router.push('/records')} variant="ghost">
                    View all tickets
                  </Button>
                }
                description="The latest triage decisions across every queue."
                title="Recent activity"
              >
                <Separator className="mb-1" />
                <Timeline testID="dashboard-activity-timeline">
                  {data.activity.map((entry) => (
                    <TimelineItem
                      description={entry.detail}
                      key={entry.id}
                      meta={
                        <Badge
                          className="mt-1 self-start"
                          variant={
                            entry.status === 'resolved'
                              ? 'success'
                              : entry.status === 'escalated'
                                ? 'destructive'
                                : entry.status === 'reassigned'
                                  ? 'info'
                                  : 'secondary'
                          }
                        >
                          {entry.meta}
                        </Badge>
                      }
                      status={ACTIVITY_STATUS_TONE[entry.status]}
                      title={
                        <Button
                          accessibilityLabel={`Open ${entry.ticketId}`}
                          className="h-auto justify-start self-start px-0 py-0"
                          onPress={() => router.push(`/records/${entry.ticketId}`)}
                          variant="ghost"
                        >
                          {entry.title}
                        </Button>
                      }
                    />
                  ))}
                </Timeline>
              </Section>
            </Card>
          </>
        )}
      </VStack>
    </KeyboardAwareScreen>
  );
}
