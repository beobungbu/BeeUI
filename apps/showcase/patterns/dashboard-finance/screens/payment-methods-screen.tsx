import { Badge, Button, Card, HStack, Text, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import { ScreenShell } from '../components/screen-shell';
import { SectionHeader } from '../components/section-header';

export type PaymentMethod = {
  detail: string;
  id: string;
  isDefault: boolean;
  label: string;
  state: 'active' | 'problem';
};

export type PaymentMethodsScreenProps = {
  methods: readonly PaymentMethod[];
  onAddMethod?: () => void;
  onManageMethod?: (method: PaymentMethod) => void;
  onRemoveMethod?: (method: PaymentMethod) => void;
};

export function PaymentMethodsScreen({ methods, onAddMethod, onManageMethod, onRemoveMethod }: PaymentMethodsScreenProps) {
  const defaultMethod = methods.find((method) => method.isDefault);

  return (
    <ScreenShell
      action={onAddMethod ? <Button onPress={onAddMethod} size="sm">Add method</Button> : undefined}
      description="Manage cards and linked accounts"
      testID="payment-methods-screen"
      title="Payment methods"
    >
      {defaultMethod ? (
        <Card className="border-primary/40 bg-primary/5" padding="lg" variant="outlined">
          <VStack gap="xs">
            <Text tone="primary" variant="caption">DEFAULT PAYMENT METHOD</Text>
            <Text variant="heading">{defaultMethod.label}</Text>
            <Text tone="muted" variant="caption">{defaultMethod.detail}</Text>
          </VStack>
        </Card>
      ) : null}

      <VStack gap="md">
        <SectionHeader description="Caller owns provider and payment SDK behavior" title="All methods" />
        {methods.map((method) => (
          <Card key={method.id} padding="lg" variant="outlined">
            <VStack gap="md">
              <HStack align="start" justify="between">
                <VStack className="min-w-0 flex-1" gap="xs">
                  <Text numberOfLines={1} variant="label">{method.label}</Text>
                  <Text tone="muted" variant="caption">{method.detail}</Text>
                </VStack>
                <HStack gap="sm" wrap>
                  {method.isDefault ? <Badge variant="info">Default</Badge> : null}
                  {method.state === 'problem' ? <Badge variant="destructive">Action needed</Badge> : null}
                </HStack>
              </HStack>
              <HStack gap="sm" wrap>
                <Button className="min-w-[120px] flex-1" onPress={() => onManageMethod?.(method)} size="sm" variant="outline">Manage</Button>
                <Button className="min-w-[120px] flex-1" onPress={() => onRemoveMethod?.(method)} size="sm" variant="ghost">Remove</Button>
              </HStack>
            </VStack>
          </Card>
        ))}
      </VStack>
    </ScreenShell>
  );
}
