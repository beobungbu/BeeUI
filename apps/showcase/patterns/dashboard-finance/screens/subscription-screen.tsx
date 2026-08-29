import { Badge, Button, Card, HStack, Progress, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { ScreenShell } from '../components/screen-shell';
import { SectionHeader } from '../components/section-header';

export type SubscriptionData = {
  benefits: readonly string[];
  billingCycle: string;
  planName: string;
  price: string;
  renewalDate: string;
  usageLabel: string;
  usageText: string;
  usageValue: number;
};

export type SubscriptionScreenProps = {
  data: SubscriptionData;
  onCancel?: () => void;
  onManage?: () => void;
  onUpgrade?: () => void;
  state?: 'active' | 'usage-warning';
};

export function SubscriptionScreen({ data, onCancel, onManage, onUpgrade, state = 'active' }: SubscriptionScreenProps) {
  const warning = state === 'usage-warning' || data.usageValue >= 80;

  return (
    <ScreenShell description="Plan, usage, and billing controls" testID="subscription-screen" title="Subscription">
      <Card padding="lg" variant="raised">
        <VStack gap="lg">
          <HStack align="start" justify="between" wrap>
            <VStack className="min-w-[180px] flex-1" gap="xs">
              <Text tone="muted" variant="caption">CURRENT PLAN</Text>
              <HStack gap="sm" wrap>
                <Text className="text-3xl" variant="title">{data.planName}</Text>
                <Badge variant="success">Active</Badge>
              </HStack>
              <Text tone="muted">{data.price}</Text>
            </VStack>
            <VStack gap="xs">
              <Text tone="muted" variant="caption">RENEWS</Text>
              <Text variant="label">{data.renewalDate}</Text>
              <Text tone="muted" variant="caption">{data.billingCycle} billing</Text>
            </VStack>
          </HStack>
          <HStack gap="md" wrap>
            <Button className="min-w-[130px] flex-1" onPress={onUpgrade}>Upgrade plan</Button>
            <Button className="min-w-[130px] flex-1" onPress={onManage} variant="outline">Manage billing</Button>
          </HStack>
        </VStack>
      </Card>

      <Card padding="lg" variant="outlined">
        <VStack gap="md">
          <SectionHeader description={data.usageText} title={data.usageLabel} />
          <Progress
            accessibilityLabel={`${data.usageLabel}, ${data.usageValue}% used`}
            indicatorClassName={warning ? 'bg-warning' : undefined}
            value={data.usageValue}
          />
          <HStack justify="between">
            <Text tone={warning ? 'warning' : 'muted'} variant="caption">{data.usageValue}% used</Text>
            <Text tone="muted" variant="caption">Resets next cycle</Text>
          </HStack>
        </VStack>
      </Card>

      <Card padding="lg" variant="outlined">
        <VStack gap="md">
          <SectionHeader title="Included with Scale" />
          {data.benefits.map((benefit) => (
            <HStack key={benefit} gap="sm">
              <Text tone="success">✓</Text>
              <Text className="min-w-0 flex-1">{benefit}</Text>
            </HStack>
          ))}
        </VStack>
      </Card>

      {warning ? (
        <Card className="border-warning/50 bg-warning/5" padding="lg" variant="outlined">
          <VStack gap="sm">
            <Text tone="warning" variant="label">You are approaching your plan limit</Text>
            <Text tone="muted" variant="caption">Upgrade before the next usage spike to avoid workflow interruptions.</Text>
          </VStack>
        </Card>
      ) : null}

      {onCancel ? <Button onPress={onCancel} variant="ghost">Cancel subscription</Button> : null}
    </ScreenShell>
  );
}
