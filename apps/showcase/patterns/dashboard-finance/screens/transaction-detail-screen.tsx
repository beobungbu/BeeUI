import { Badge, Button, Card, DescriptionItem, DescriptionList, HStack, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { ScreenShell } from '../components/screen-shell';

export type TransactionDetailData = {
  amount: string;
  category: string;
  description: string;
  id: string;
  merchant: string;
  paymentMethod: string;
  reference: string;
  status: string;
  timestamp: string;
};

export type TransactionDetailScreenProps = {
  data: TransactionDetailData;
  onGetHelp?: () => void;
  onReceipt?: () => void;
};

export function TransactionDetailScreen({ data, onGetHelp, onReceipt }: TransactionDetailScreenProps) {
  return (
    <ScreenShell description={data.timestamp} testID="transaction-detail-screen" title="Transaction detail">
      <Card className="items-center" padding="lg" variant="raised">
        <VStack align="center" gap="sm">
          <Text tone="muted" variant="caption">{data.merchant}</Text>
          <Text className="text-3xl" variant="title">{data.amount}</Text>
          <Badge variant="success">{data.status}</Badge>
        </VStack>
      </Card>

      <Card padding="lg" variant="outlined">
        <VStack gap="md">
          <Text variant="heading">Details</Text>
          <DescriptionList>
            <DescriptionItem label="Merchant / payee" value={data.merchant} />
            <DescriptionItem label="Timestamp" value={data.timestamp} />
            <DescriptionItem label="Payment method" value={data.paymentMethod} />
            <DescriptionItem label="Reference ID" value={data.reference} />
            <DescriptionItem label="Category" value={data.category} />
            <DescriptionItem label="Description" value={data.description} />
          </DescriptionList>
        </VStack>
      </Card>

      <HStack gap="md" wrap>
        <Button className="min-w-[150px] flex-1" onPress={onReceipt} variant="outline">View receipt</Button>
        <Button className="min-w-[150px] flex-1" onPress={onGetHelp} variant="ghost">Get help</Button>
      </HStack>
    </ScreenShell>
  );
}
