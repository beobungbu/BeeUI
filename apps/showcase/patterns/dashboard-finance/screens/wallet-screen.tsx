import { Button, Card, EmptyState, HStack, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { BalanceCard } from '../components/balance-card';
import { ScreenShell } from '../components/screen-shell';
import { SectionHeader } from '../components/section-header';
import { TransactionRow, type TransactionRowData } from '../components/transaction-row';

export type WalletAccount = {
  balance: string;
  detail: string;
  id: string;
  name: string;
};

export type WalletData = {
  accounts: readonly WalletAccount[];
  available: string;
  balance: string;
  recent: readonly TransactionRowData[];
};

export type WalletScreenProps = {
  data: WalletData;
  onAccountPress?: (account: WalletAccount) => void;
  onAddMoney?: () => void;
  onAddPaymentMethod?: () => void;
  onReceive?: () => void;
  onSend?: () => void;
  onTransactionPress?: (transaction: TransactionRowData) => void;
  state?: 'active' | 'no-payment-methods';
};

export function WalletScreen({
  data,
  onAccountPress,
  onAddMoney,
  onAddPaymentMethod,
  onReceive,
  onSend,
  onTransactionPress,
  state = 'active',
}: WalletScreenProps) {
  return (
    <ScreenShell description="Cash, cards, and connected accounts" testID="wallet-screen" title="Wallet">
      <BalanceCard
        actions={[
          { label: 'Add', onPress: onAddMoney },
          { label: 'Send', onPress: onSend },
          { label: 'Receive', onPress: onReceive },
        ]}
        availableLabel="Available"
        availableValue={data.available}
        eyebrow="Wallet balance"
        value={data.balance}
      />

      <Card padding="lg" variant="outlined">
        <VStack gap="md">
          <SectionHeader title="Connected accounts" />
          {state === 'no-payment-methods' || !data.accounts.length ? (
            <EmptyState
              action={onAddPaymentMethod ? <Button onPress={onAddPaymentMethod}>Add payment method</Button> : undefined}
              description="Connect a bank account or card to make transfers easier."
              title="No payment methods"
            />
          ) : (
            data.accounts.map((account) => (
              <Button
                key={account.id}
                accessibilityLabel={`${account.name}, ${account.balance}`}
                className="h-auto min-h-16 justify-start px-3 py-3"
                onPress={() => onAccountPress?.(account)}
                variant="ghost"
              >
                <HStack className="w-full" justify="between">
                  <VStack className="min-w-0 flex-1" gap="xs">
                    <Text numberOfLines={1} variant="label">{account.name}</Text>
                    <Text numberOfLines={1} tone="muted" variant="caption">{account.detail}</Text>
                  </VStack>
                  <Text variant="label">{account.balance}</Text>
                </HStack>
              </Button>
            ))
          )}
        </VStack>
      </Card>

      <Card padding="lg" variant="outlined">
        <VStack gap="sm">
          <SectionHeader title="Recent wallet activity" />
          {data.recent.map((transaction) => (
            <TransactionRow key={transaction.id} onPress={onTransactionPress} transaction={transaction} />
          ))}
        </VStack>
      </Card>
    </ScreenShell>
  );
}
