import { Text } from '@beemvp/beeui-ui';
import * as React from 'react';

export type TrendDirection = 'up' | 'down' | 'flat';

export type TrendIndicatorProps = {
  direction: TrendDirection;
  label: string;
};

export function TrendIndicator({ direction, label }: TrendIndicatorProps) {
  const symbol = direction === 'up' ? '↗' : direction === 'down' ? '↘' : '→';
  const tone = direction === 'up' ? 'success' : direction === 'down' ? 'destructive' : 'muted';

  return (
    <Text accessibilityLabel={`${direction} ${label}`} tone={tone} variant="caption">
      {symbol} {label}
    </Text>
  );
}
