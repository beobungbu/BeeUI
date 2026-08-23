import { fireEvent, render } from '@testing-library/react-native';
import * as React from 'react';
import {
  AnalyticsScreen,
  DashboardOverviewScreen,
  InvoiceDetailScreen,
  MiniBarChart,
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

const balance = '$24,860.00';

describe('dashboard + finance patterns', () => {
  it('renders all eight screens without router context', () => {
    const cases = [
      [<DashboardOverviewScreen data={dashboardOverviewFixture} />, 'dashboard-overview-screen'],
      [<AnalyticsScreen data={analyticsFixture} onRangeChange={() => undefined} />, 'analytics-screen'],
      [<TransactionsScreen balance={balance} groups={transactionGroupsFixture} onFilterChange={() => undefined} />, 'transactions-screen'],
      [<TransactionDetailScreen data={transactionDetailFixture} />, 'transaction-detail-screen'],
      [<WalletScreen data={walletFixture} />, 'wallet-screen'],
      [<PaymentMethodsScreen methods={paymentMethodsFixture} />, 'payment-methods-screen'],
      [<SubscriptionScreen data={subscriptionFixture} />, 'subscription-screen'],
      [<InvoiceDetailScreen data={invoiceFixture} />, 'invoice-detail-screen'],
    ] as const;

    for (const [element, testID] of cases) {
      const screen = render(element);
      expect(screen.getByTestId(testID)).toBeTruthy();
      screen.unmount();
    }
  });

  it('preserves dashboard and transaction selection callbacks', () => {
    const onCreateInvoice = jest.fn();
    const onTransactionPress = jest.fn();
    const screen = render(
      <DashboardOverviewScreen
        data={dashboardOverviewFixture}
        onCreateInvoice={onCreateInvoice}
        onTransactionPress={onTransactionPress}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'New invoice' }));
    fireEvent.press(screen.getByTestId('transaction-tx-101'));

    expect(onCreateInvoice).toHaveBeenCalledTimes(1);
    expect(onTransactionPress).toHaveBeenCalledWith(dashboardOverviewFixture.activity[0]);
  });

  it('preserves payment method callbacks', () => {
    const onAddMethod = jest.fn();
    const onManageMethod = jest.fn();
    const screen = render(
      <PaymentMethodsScreen
        methods={paymentMethodsFixture}
        onAddMethod={onAddMethod}
        onManageMethod={onManageMethod}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Add method' }));
    fireEvent.press(screen.getAllByRole('button', { name: 'Manage' })[0]);

    expect(onAddMethod).toHaveBeenCalledTimes(1);
    expect(onManageMethod).toHaveBeenCalledWith(paymentMethodsFixture[0]);
  });

  it('preserves subscription and invoice callbacks', () => {
    const onManage = jest.fn();
    const subscription = render(<SubscriptionScreen data={subscriptionFixture} onManage={onManage} />);
    fireEvent.press(subscription.getByRole('button', { name: 'Manage billing' }));
    expect(onManage).toHaveBeenCalledTimes(1);
    subscription.unmount();

    const onDownload = jest.fn();
    const onShare = jest.fn();
    const invoice = render(<InvoiceDetailScreen data={invoiceFixture} onDownload={onDownload} onShare={onShare} />);
    fireEvent.press(invoice.getByRole('button', { name: 'Download' }));
    fireEvent.press(invoice.getByRole('button', { name: 'Share' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('renders loading, empty, and error states', () => {
    const loading = render(<DashboardOverviewScreen state="loading" />);
    expect(loading.getByTestId('dashboard-loading')).toBeTruthy();
    loading.unmount();

    const empty = render(
      <TransactionsScreen
        balance={balance}
        groups={[]}
        onFilterChange={() => undefined}
        state="filtered-empty"
      />,
    );
    expect(empty.getByText('No matching transactions')).toBeTruthy();
    empty.unmount();

    const error = render(
      <TransactionsScreen
        balance={balance}
        groups={[]}
        onFilterChange={() => undefined}
        state="error"
      />,
    );
    expect(error.getByText('Transactions unavailable')).toBeTruthy();
  });

  it('supports wallet empty and subscription warning states', () => {
    const wallet = render(<WalletScreen data={{ ...walletFixture, accounts: [] }} state="no-payment-methods" />);
    expect(wallet.getByText('No payment methods')).toBeTruthy();
    wallet.unmount();

    const subscription = render(<SubscriptionScreen data={subscriptionFixture} state="usage-warning" />);
    expect(subscription.getByText('You are approaching your plan limit')).toBeTruthy();
  });

  it('keeps zero-value chart data on the baseline', () => {
    const screen = render(
      <MiniBarChart
        data={[
          { label: 'Zero', value: 0 },
          { label: 'Positive', value: 100 },
        ]}
      />,
    );

    expect(screen.getByTestId('bar-Zero').props.style).toEqual({ height: '0%' });
    expect(screen.getByTestId('bar-Positive').props.style).toEqual({ height: '100%' });
  });

  it('passes the dedicated pattern TypeScript project', () => {
    const { execFileSync } = require('child_process') as typeof import('child_process');
    const path = require('path') as typeof import('path');
    const root = path.resolve(__dirname, '../../../..');
    const tsc = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');

    execFileSync(
      tsc,
      ['-p', 'apps/showcase/patterns/dashboard-finance/tsconfig.json', '--noEmit'],
      { cwd: root, stdio: 'inherit' },
    );
  }, 30000);

  it('uses only the public BeeUI package import surface', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const root = path.resolve(__dirname, '../../patterns/dashboard-finance');
    const files: string[] = [];

    const visit = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(fullPath);
        else if (/\.tsx?$/.test(entry.name)) files.push(fullPath);
      }
    };

    visit(root);
    const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toMatch(/from ['"]@beeui\/ui\//);
  });
});
