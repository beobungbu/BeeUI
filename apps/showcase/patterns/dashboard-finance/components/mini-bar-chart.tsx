import { Box, Text } from '@beemvp/beeui-ui';
import * as React from 'react';

export type MiniBarDatum = {
  label: string;
  value: number;
};

export type MiniBarChartProps = {
  data: readonly MiniBarDatum[];
  max?: number;
};

export function MiniBarChart({ data, max }: MiniBarChartProps) {
  const resolvedMax = Math.max(max ?? 0, ...data.map((item) => item.value), 1);

  return (
    <Box accessibilityLabel="Trend chart" accessibilityRole="image" className="w-full gap-3">
      <Box className="h-28 flex-row items-end gap-2 rounded-lg bg-surface-muted px-3 pt-4">
        {data.map((item) => {
          const percent = item.value <= 0 ? 0 : Math.max(8, Math.min(100, (item.value / resolvedMax) * 100));
          return (
            <Box key={item.label} className="min-w-0 flex-1 items-center justify-end gap-2">
              <Box
                className="w-full rounded-t-md bg-primary"
                style={{ height: `${percent}%` }}
                testID={`bar-${item.label}`}
              />
            </Box>
          );
        })}
      </Box>
      <Box className="flex-row gap-2">
        {data.map((item) => (
          <Text key={item.label} className="min-w-0 flex-1 text-center" tone="muted" variant="caption">
            {item.label}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
