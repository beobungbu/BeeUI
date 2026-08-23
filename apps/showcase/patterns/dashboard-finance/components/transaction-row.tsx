import { Badge, Box, HStack, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { Pressable } from 'react-native';

export type TransactionStatus = 'completed' | 'pending' | 'failed';
export type TransactionDirection = 'income' | 'expense';

export type TransactionRowData = {
  amount: string;
  direction: TransactionDirection;
  id: string;
  merchant: string;
  meta: string;
  status: TransactionStatus;
};

export type TransactionRowProps = {
  onPress?: (transaction: TransactionRowData) => void;
  transaction: TransactionRowData;
};

const badgeByStatus = {
  completed: 'success',
  failed: 'destructive',
  pending: 'warning',
} as const;

export function TransactionRow({ onPress, transaction }: TransactionRowProps) {
  return (
    <Pressable
      accessibilityLabel={`${transaction.merchant}, ${transaction.amount}`}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={() => onPress?.(transaction)}
      style={({ pressed }) => ({ minHeight: 64, opacity: pressed ? 0.72 : 1 })}
      testID={`transaction-${transaction.id}`}
    >
      <Box className="min-h-16 flex-row items-center gap-3 rounded-lg px-1 py-3">
        <VStack className="min-w-0 flex-1" gap="xs">
          <HStack gap="sm" wrap>
            <Text className="min-w-0 flex-1" numberOfLines={1} variant="label">
              {transaction.merchant}
            </Text>
            {transaction.status !== 'completed' ? (
              <Badge variant={badgeByStatus[transaction.status]}>{transaction.status}</Badge>
            ) : null}
          </HStack>
          <Text numberOfLines={1} tone="muted" variant="caption">{transaction.meta}</Text>
        </VStack>
        <Text
          className="shrink-0 text-right"
          tone={transaction.direction === 'income' ? 'success' : 'default'}
          variant="label"
        >
          {transaction.direction === 'income' ? '+' : '−'}{transaction.amount}
        </Text>
      </Box>
    </Pressable>
  );
}
