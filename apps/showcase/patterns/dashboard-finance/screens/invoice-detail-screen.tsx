import { Badge, Button, Card, DescriptionItem, DescriptionList, HStack, Text, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import { ScreenShell } from '../components/screen-shell';
import { SectionHeader } from '../components/section-header';

export type InvoiceLineItem = {
  amount: string;
  id: string;
  label: string;
  quantity: string;
};

export type InvoiceData = {
  company: string;
  customer: string;
  dueDate: string;
  issueDate: string;
  lineItems: readonly InvoiceLineItem[];
  number: string;
  paymentStatus: string;
  status: string;
  subtotal: string;
  tax: string;
  total: string;
};

export type InvoiceDetailScreenProps = {
  data: InvoiceData;
  onDownload?: () => void;
  onShare?: () => void;
};

export function InvoiceDetailScreen({ data, onDownload, onShare }: InvoiceDetailScreenProps) {
  return (
    <ScreenShell
      action={<Badge variant="success">{data.status}</Badge>}
      description={data.number}
      testID="invoice-detail-screen"
      title="Invoice"
    >
      <Card padding="lg" variant="raised">
        <VStack gap="lg">
          <HStack align="start" justify="between" wrap>
            <VStack className="min-w-[180px] flex-1" gap="xs">
              <Text tone="muted" variant="caption">TOTAL</Text>
              <Text className="text-3xl" variant="title">{data.total}</Text>
              <Text tone="success" variant="caption">{data.paymentStatus}</Text>
            </VStack>
            <VStack gap="xs">
              <Text tone="muted" variant="caption">DUE DATE</Text>
              <Text variant="label">{data.dueDate}</Text>
            </VStack>
          </HStack>
          <HStack gap="md" wrap>
            <Button className="min-w-[130px] flex-1" onPress={onDownload}>Download</Button>
            <Button className="min-w-[130px] flex-1" onPress={onShare} variant="outline">Share</Button>
          </HStack>
        </VStack>
      </Card>

      <Card padding="lg" variant="outlined">
        <VStack gap="md">
          <SectionHeader title="Bill to" />
          <DescriptionList>
            <DescriptionItem label="From" value={data.company} />
            <DescriptionItem label="Customer" value={data.customer} />
            <DescriptionItem label="Issue date" value={data.issueDate} />
            <DescriptionItem label="Due date" value={data.dueDate} />
          </DescriptionList>
        </VStack>
      </Card>

      <Card padding="lg" variant="outlined">
        <VStack gap="md">
          <SectionHeader title="Line items" />
          {data.lineItems.map((item) => (
            <HStack key={item.id} align="start" justify="between">
              <VStack className="min-w-0 flex-1" gap="xs">
                <Text variant="label">{item.label}</Text>
                <Text tone="muted" variant="caption">Qty {item.quantity}</Text>
              </VStack>
              <Text variant="label">{item.amount}</Text>
            </HStack>
          ))}
          <VStack className="border-t border-border pt-3" gap="sm">
            <HStack justify="between"><Text tone="muted">Subtotal</Text><Text>{data.subtotal}</Text></HStack>
            <HStack justify="between"><Text tone="muted">Tax</Text><Text>{data.tax}</Text></HStack>
            <HStack justify="between"><Text variant="heading">Total</Text><Text variant="heading">{data.total}</Text></HStack>
          </VStack>
        </VStack>
      </Card>
    </ScreenShell>
  );
}
