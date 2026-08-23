export const dashboardOverviewFixture = {
  accountLabel: 'Northstar Studio · Operating account',
  balance: '$24,860.00',
  balanceTrend: { direction: 'up' as const, label: '8.4% vs last month' },
  greeting: 'Good morning, Alex',
  metrics: [
    { label: 'Monthly revenue', value: '$18,420', trend: { direction: 'up' as const, label: '12.8%' } },
    { label: 'Active customers', value: '1,284', trend: { direction: 'up' as const, label: '6.2%' } },
    { label: 'Conversion', value: '4.8%', trend: { direction: 'flat' as const, label: '0.1%' } },
    { label: 'Expenses', value: '$7,360', trend: { direction: 'down' as const, label: '3.1%' } },
  ],
  trend: [
    { label: 'Mar', value: 46 },
    { label: 'Apr', value: 58 },
    { label: 'May', value: 52 },
    { label: 'Jun', value: 71 },
    { label: 'Jul', value: 68 },
    { label: 'Aug', value: 86 },
  ],
  activity: [
    { id: 'tx-101', merchant: 'Acme Enterprise', meta: 'Today · Invoice #1842', amount: '$2,400.00', direction: 'income' as const, status: 'completed' as const },
    { id: 'tx-102', merchant: 'Cloud hosting subscription with an intentionally long merchant name', meta: 'Today · Infrastructure', amount: '$386.90', direction: 'expense' as const, status: 'pending' as const },
    { id: 'tx-103', merchant: 'Payroll', meta: 'Yesterday · Team', amount: '$8,920.00', direction: 'expense' as const, status: 'completed' as const },
  ],
};

export const analyticsFixture = {
  selectedRange: '30d',
  ranges: [
    { label: '7D', value: '7d' },
    { label: '30D', value: '30d' },
    { label: '90D', value: '90d' },
  ],
  headline: '$18,420',
  headlineLabel: 'Net revenue',
  comparison: { direction: 'up' as const, label: '12.8% from previous period' },
  bars: [
    { label: 'W1', value: 42 },
    { label: 'W2', value: 61 },
    { label: 'W3', value: 56 },
    { label: 'W4', value: 83 },
  ],
  breakdown: [
    { label: 'Subscriptions', value: '$9,840', percent: 54 },
    { label: 'Services', value: '$5,420', percent: 29 },
    { label: 'Marketplace', value: '$3,160', percent: 17 },
  ],
};
