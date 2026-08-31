import { useToast } from '@beemvp/beeui-ui';
import * as React from 'react';
import {
  AnalyticsScreen,
  DashboardOverviewScreen,
  InvoiceDetailScreen,
  PaymentMethodsScreen,
  SubscriptionScreen,
  TransactionDetailScreen,
  TransactionsScreen,
  WalletScreen,
  analyticsFixture,
  dashboardOverviewFixture,
  invoiceFixture,
  paymentMethodsFixture,
  subscriptionFixture,
  transactionDetailFixture,
  transactionGroupsFixture,
  walletFixture,
} from '../../patterns/dashboard-finance';
import type { PatternDemoProps, PatternDomain } from '../types';

function DashboardOverviewDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  const state = stateId === 'loading' ? 'loading' : stateId === 'empty' ? 'empty' : 'ready';
  return (
    <DashboardOverviewScreen
      data={state === 'ready' ? dashboardOverviewFixture : undefined}
      onCreateInvoice={() => toast.show({ title: 'New invoice' })}
      onPrimaryAction={() => toast.show({ title: 'Primary finance action' })}
      onTransactionPress={(transaction) => toast.show({ title: transaction.merchant, description: transaction.meta })}
      onViewActivity={() => toast.show({ title: 'View activity' })}
      state={state}
    />
  );
}

function AnalyticsDemo({ stateId }: PatternDemoProps) {
  const [range, setRange] = React.useState(analyticsFixture.selectedRange);
  return (
    <AnalyticsScreen
      data={stateId === 'empty' ? undefined : { ...analyticsFixture, selectedRange: range }}
      onRangeChange={setRange}
      state={stateId === 'empty' ? 'empty' : 'ready'}
    />
  );
}

function TransactionsDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  const [filter, setFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const state = stateId === 'filtered-empty' ? 'filtered-empty' : stateId === 'error' ? 'error' : 'ready';
  return (
    <TransactionsScreen
      balance="$24,860.00"
      filter={filter}
      groups={state === 'ready' ? transactionGroupsFixture : []}
      onFilterChange={setFilter}
      onQueryChange={setQuery}
      onRetry={() => toast.show({ title: 'Retry requested' })}
      onSearch={(value) => toast.show({ title: 'Search', description: value || 'All transactions' })}
      onTransactionPress={(transaction) => toast.show({ title: transaction.merchant, description: transaction.meta })}
      query={query}
      state={state}
    />
  );
}

function TransactionDetailDemo() {
  return <TransactionDetailScreen data={transactionDetailFixture} />;
}

function WalletDemo({ stateId }: PatternDemoProps) {
  return (
    <WalletScreen
      data={stateId === 'no-payment-methods' ? { ...walletFixture, accounts: [] } : walletFixture}
      state={stateId === 'no-payment-methods' ? 'no-payment-methods' : 'active'}
    />
  );
}

function PaymentMethodsDemo() {
  const toast = useToast();
  return (
    <PaymentMethodsScreen
      methods={paymentMethodsFixture}
      onAddMethod={() => toast.show({ title: 'Add payment method' })}
      onManageMethod={(method) => toast.show({ title: 'Manage method', description: method.label })}
    />
  );
}

function SubscriptionDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  return (
    <SubscriptionScreen
      data={subscriptionFixture}
      onManage={() => toast.show({ title: 'Manage billing' })}
      state={stateId === 'usage-warning' ? 'usage-warning' : 'active'}
    />
  );
}

function InvoiceDetailDemo() {
  const toast = useToast();
  return (
    <InvoiceDetailScreen
      data={invoiceFixture}
      onDownload={() => toast.show({ title: 'Invoice downloaded', variant: 'success' })}
      onShare={() => toast.show({ title: 'Share invoice' })}
    />
  );
}

export const dashboardFinancePatternDomain: PatternDomain = {
  id: 'dashboard-finance',
  title: 'Dashboard & Finance',
  description: 'Operational overview, analytics, transactions, wallet, billing, and invoice patterns.',
  screens: [
    {
      id: 'dashboard-overview',
      title: 'Dashboard Overview',
      description: 'Dense business overview with KPIs, trend, actions, and recent activity.',
      source: DashboardOverviewScreen,
      component: DashboardOverviewDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'loading', title: 'Loading' },
        { id: 'empty', title: 'Empty' },
      ],
    },
    {
      id: 'analytics',
      title: 'Analytics',
      description: 'Range-controlled KPI, chart, and category breakdown.',
      source: AnalyticsScreen,
      component: AnalyticsDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'empty', title: 'Empty' },
      ],
    },
    {
      id: 'transactions',
      title: 'Transactions',
      description: 'Searchable and filterable transaction history.',
      source: TransactionsScreen,
      component: TransactionsDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'filtered-empty', title: 'Filtered empty' },
        { id: 'error', title: 'Error' },
      ],
    },
    { id: 'transaction-detail', title: 'Transaction Detail', description: 'Detailed transaction summary and metadata.', source: TransactionDetailScreen, component: TransactionDetailDemo },
    {
      id: 'wallet',
      title: 'Wallet',
      description: 'Balances, payment accounts, and wallet actions.',
      source: WalletScreen,
      component: WalletDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'no-payment-methods', title: 'No methods' },
      ],
    },
    { id: 'payment-methods', title: 'Payment Methods', description: 'Saved payment methods and management actions.', source: PaymentMethodsScreen, component: PaymentMethodsDemo },
    {
      id: 'subscription',
      title: 'Subscription',
      description: 'Plan, usage, billing, and limit warning presentation.',
      source: SubscriptionScreen,
      component: SubscriptionDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'usage-warning', title: 'Usage warning' },
      ],
    },
    { id: 'invoice-detail', title: 'Invoice Detail', description: 'Invoice totals, line items, download, and share actions.', source: InvoiceDetailScreen, component: InvoiceDetailDemo },
  ],
};
