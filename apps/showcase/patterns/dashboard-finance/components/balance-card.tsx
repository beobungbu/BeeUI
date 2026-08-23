import { Button, Card, HStack, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { TrendIndicator, type TrendDirection } from './trend-indicator';

export type BalanceCardAction = {
  label: string;
  onPress?: () => void;
};

export type BalanceCardProps = {
  actions?: readonly BalanceCardAction[];
  availableLabel?: string;
  availableValue?: string;
  eyebrow: string;
  trend?: {
    direction: TrendDirection;
    label: string;
  };
  value: string;
};

export function BalanceCard({ actions, availableLabel, availableValue, eyebrow, trend, value }: BalanceCardProps) {
  return (
    <Card className="overflow-hidden border-primary bg-primary" padding="lg">
      <VStack gap="lg">
        <VStack gap="xs">
          <Text className="text-primary-foreground/80" variant="caption">{eyebrow}</Text>
          <Text className="text-3xl text-primary-foreground" variant="title">{value}</Text>
          {trend ? <TrendIndicator direction={trend.direction} label={trend.label} /> : null}
          {availableLabel && availableValue ? (
            <Text className="text-primary-foreground/80" variant="caption">
              {availableLabel}: {availableValue}
            </Text>
          ) : null}
        </VStack>
        {actions?.length ? (
          <HStack gap="sm" wrap>
            {actions.map((action) => (
              <Button
                key={action.label}
                className="min-w-[96px] flex-1 border-primary-foreground/30 bg-primary-foreground/10"
                labelClassName="text-primary-foreground"
                onPress={action.onPress}
                size="sm"
                variant="outline"
              >
                {action.label}
              </Button>
            ))}
          </HStack>
        ) : null}
      </VStack>
    </Card>
  );
}
