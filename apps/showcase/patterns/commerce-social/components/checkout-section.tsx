import { Card, Text, VStack } from '@beeui/ui';
import * as React from 'react';

export type CheckoutSectionProps = {
  children: React.ReactNode;
  description?: string;
  title: string;
};

export function CheckoutSection({ children, description, title }: CheckoutSectionProps) {
  return (
    <Card className="gap-4 p-4" variant="raised">
      <VStack gap="xs">
        <Text variant="heading">{title}</Text>
        {description ? <Text tone="muted" variant="caption">{description}</Text> : null}
      </VStack>
      {children}
    </Card>
  );
}
