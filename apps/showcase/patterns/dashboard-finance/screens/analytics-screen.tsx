import { Card, EmptyState, HStack, Progress, Stat, StatLabel, StatValue, Tabs, TabsList, TabsTrigger, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { MiniBarChart, type MiniBarDatum } from '../components/mini-bar-chart';
import { ScreenShell } from '../components/screen-shell';
import { SectionHeader } from '../components/section-header';
import { TrendIndicator, type TrendDirection } from '../components/trend-indicator';

export type AnalyticsBreakdown = { label: string; percent: number; value: string };
export type AnalyticsRange = { label: string; value: string };
export type AnalyticsData = {
  bars: readonly MiniBarDatum[];
  breakdown: readonly AnalyticsBreakdown[];
  comparison: { direction: TrendDirection; label: string };
  headline: string;
  headlineLabel: string;
  ranges: readonly AnalyticsRange[];
  selectedRange: string;
};

export type AnalyticsScreenProps = {
  data?: AnalyticsData;
  onRangeChange?: (value: string) => void;
  state?: 'ready' | 'empty';
};

export function AnalyticsScreen({ data, onRangeChange, state = 'ready' }: AnalyticsScreenProps) {
  if (state === 'empty' || !data) {
    return (
      <ScreenShell description="Performance and category mix" testID="analytics-screen" title="Analytics">
        <EmptyState description="Try a wider reporting period once transactions are available." title="No analytics for this period" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell description="Performance and category mix" testID="analytics-screen" title="Analytics">
      <Tabs onValueChange={onRangeChange} value={data.selectedRange}>
        <TabsList>
          {data.ranges.map((range) => <TabsTrigger key={range.value} value={range.value}>{range.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <Card padding="lg" variant="raised">
        <VStack gap="lg">
          <HStack align="end" justify="between" wrap>
            <Stat className="min-w-[180px] flex-1">
              <StatLabel>{data.headlineLabel}</StatLabel>
              <StatValue className="text-3xl">{data.headline}</StatValue>
              <TrendIndicator {...data.comparison} />
            </Stat>
            <Text tone="muted" variant="caption">Caller-supplied formatted values</Text>
          </HStack>
          <MiniBarChart data={data.bars} />
        </VStack>
      </Card>

      <Card padding="lg" variant="outlined">
        <VStack gap="lg">
          <SectionHeader description="Share of net revenue" title="Revenue mix" />
          {data.breakdown.map((item) => (
            <VStack key={item.label} gap="sm">
              <HStack justify="between">
                <Text variant="label">{item.label}</Text>
                <Text variant="label">{item.value}</Text>
              </HStack>
              <Progress accessibilityLabel={`${item.label} ${item.percent}%`} value={item.percent} />
              <Text tone="muted" variant="caption">{item.percent}% of total</Text>
            </VStack>
          ))}
        </VStack>
      </Card>
    </ScreenShell>
  );
}
