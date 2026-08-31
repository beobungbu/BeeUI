import { Button, Card, EmptyState, HStack, Skeleton, Text, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import { BalanceCard } from '../components/balance-card';
import { MetricCard } from '../components/metric-card';
import { MiniBarChart, type MiniBarDatum } from '../components/mini-bar-chart';
import { ScreenShell } from '../components/screen-shell';
import { SectionHeader } from '../components/section-header';
import { TransactionRow, type TransactionRowData } from '../components/transaction-row';
import { type TrendDirection } from '../components/trend-indicator';

export type DashboardMetric = {
  label: string;
  trend: { direction: TrendDirection; label: string };
  value: string;
};

export type DashboardOverviewData = {
  accountLabel: string;
  activity: readonly TransactionRowData[];
  balance: string;
  balanceTrend: { direction: TrendDirection; label: string };
  greeting: string;
  metrics: readonly DashboardMetric[];
  trend: readonly MiniBarDatum[];
};

export type DashboardOverviewScreenProps = {
  data?: DashboardOverviewData;
  onCreateInvoice?: () => void;
  onPrimaryAction?: () => void;
  onTransactionPress?: (transaction: TransactionRowData) => void;
  onViewActivity?: () => void;
  state?: 'ready' | 'loading' | 'empty';
};

function DashboardLoading() {
  return (
    <VStack gap="lg" testID="dashboard-loading">
      <Skeleton className="h-40" />
      <HStack gap="md" wrap>
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28 min-w-[176px] flex-1" />)}
      </HStack>
      <Skeleton className="h-52" />
    </VStack>
  );
}

export function DashboardOverviewScreen({
  data,
  onCreateInvoice,
  onPrimaryAction,
  onTransactionPress,
  onViewActivity,
  state = 'ready',
}: DashboardOverviewScreenProps) {
  if (state === 'loading') {
    return (
      <ScreenShell description="A current snapshot of the business" testID="dashboard-overview-screen" title="Overview">
        <DashboardLoading />
      </ScreenShell>
    );
  }

  if (state === 'empty' || !data) {
    return (
      <ScreenShell description="A current snapshot of the business" testID="dashboard-overview-screen" title="Overview">
        <EmptyState
          action={onPrimaryAction ? <Button onPress={onPrimaryAction}>Add first account</Button> : undefined}
          description="Connect an account or add your first transaction to populate this workspace."
          title="No dashboard data yet"
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      action={onCreateInvoice ? <Button onPress={onCreateInvoice} size="sm">New invoice</Button> : undefined}
      description={data.accountLabel}
      testID="dashboard-overview-screen"
      title={data.greeting}
    >
      <BalanceCard
        actions={[
          { label: 'Add money', onPress: onPrimaryAction },
          { label: 'Send', onPress: onPrimaryAction },
          { label: 'Request', onPress: onCreateInvoice },
        ]}
        eyebrow="Total balance"
        trend={data.balanceTrend}
        value={data.balance}
      />

      <HStack align="stretch" gap="md" wrap>
        {data.metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </HStack>

      <HStack align="stretch" gap="lg" wrap>
        <Card className="min-w-[280px] flex-[2]" padding="lg" variant="raised">
          <VStack gap="lg">
            <SectionHeader description="Six-period movement" title="Revenue trend" />
            <MiniBarChart data={data.trend} />
          </VStack>
        </Card>
        <Card className="min-w-[250px] flex-1" padding="lg" variant="outlined">
          <VStack gap="md">
            <SectionHeader description="Useful next steps" title="Shortcuts" />
            <Button onPress={onCreateInvoice} variant="outline">Create invoice</Button>
            <Button onPress={onPrimaryAction} variant="outline">Transfer funds</Button>
            <Button onPress={onViewActivity} variant="ghost">Review cash flow</Button>
          </VStack>
        </Card>
      </HStack>

      <Card padding="lg" variant="outlined">
        <VStack gap="md">
          <SectionHeader actionLabel="View all" onAction={onViewActivity} title="Recent activity" />
          {data.activity.map((transaction) => (
            <TransactionRow key={transaction.id} onPress={onTransactionPress} transaction={transaction} />
          ))}
          {!data.activity.length ? <Text tone="muted">No recent activity.</Text> : null}
        </VStack>
      </Card>
    </ScreenShell>
  );
}
