import { Button, Card, EmptyState, ErrorState, SearchInput, Tabs, TabsList, TabsTrigger, Text, VStack } from '@beemvp/beeui-ui';
import * as React from 'react';
import { ScreenShell } from '../components/screen-shell';
import { TransactionRow, type TransactionRowData } from '../components/transaction-row';

export type TransactionGroup = {
  label: string;
  transactions: readonly TransactionRowData[];
};

export type TransactionsScreenProps = {
  balance: string;
  filter?: string;
  groups: readonly TransactionGroup[];
  onFilterChange?: (value: string) => void;
  onQueryChange?: (value: string) => void;
  onRetry?: () => void;
  onSearch?: (value: string) => void;
  onTransactionPress?: (transaction: TransactionRowData) => void;
  query?: string;
  state?: 'ready' | 'filtered-empty' | 'error';
};

export function TransactionsScreen({
  balance,
  filter = 'all',
  groups,
  onFilterChange,
  onQueryChange,
  onRetry,
  onSearch,
  onTransactionPress,
  query,
  state = 'ready',
}: TransactionsScreenProps) {
  return (
    <ScreenShell description={`Available balance ${balance}`} testID="transactions-screen" title="Transactions">
      <SearchInput
        accessibilityLabel="Search transactions"
        onChangeText={onQueryChange}
        onSearch={onSearch}
        placeholder="Search merchant or reference"
        value={query}
      />

      <Tabs onValueChange={onFilterChange} value={filter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="expense">Expense</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
        </TabsList>
      </Tabs>

      {state === 'error' ? (
        <ErrorState action={onRetry ? <Button onPress={onRetry}>Try again</Button> : undefined} description="We could not load your latest transactions." title="Transactions unavailable" />
      ) : state === 'filtered-empty' ? (
        <EmptyState description="Change the search term or filter to see more activity." title="No matching transactions" />
      ) : (
        <VStack gap="lg">
          {groups.map((group) => (
            <Card key={group.label} padding="lg" variant="outlined">
              <VStack gap="sm">
                <Text tone="muted" variant="caption">{group.label.toUpperCase()}</Text>
                {group.transactions.map((transaction) => (
                  <TransactionRow key={transaction.id} onPress={onTransactionPress} transaction={transaction} />
                ))}
              </VStack>
            </Card>
          ))}
        </VStack>
      )}
    </ScreenShell>
  );
}
