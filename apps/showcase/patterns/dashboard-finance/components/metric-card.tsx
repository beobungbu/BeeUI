import { Card, Stat, StatHelpText, StatLabel, StatValue } from '@beeui/ui';
import * as React from 'react';
import { TrendIndicator, type TrendDirection } from './trend-indicator';

export type MetricCardProps = {
  helpText?: string;
  label: string;
  trend?: {
    direction: TrendDirection;
    label: string;
  };
  value: string;
};

export function MetricCard({ helpText, label, trend, value }: MetricCardProps) {
  return (
    <Card className="min-w-[176px] flex-1" padding="md" variant="raised">
      <Stat>
        <StatLabel>{label}</StatLabel>
        <StatValue numberOfLines={1}>{value}</StatValue>
        {trend ? <TrendIndicator direction={trend.direction} label={trend.label} /> : null}
        {!trend && helpText ? <StatHelpText>{helpText}</StatHelpText> : null}
      </Stat>
    </Card>
  );
}
