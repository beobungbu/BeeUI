export const transactionGroupsFixture = [
  {
    label: 'Today',
    transactions: [
      { id: 'tx-201', merchant: 'Figma', meta: 'Design tools · 09:42', amount: '$18.00', direction: 'expense' as const, status: 'completed' as const },
      { id: 'tx-202', merchant: 'Atlas Consulting', meta: 'Client payment · 08:10', amount: '$3,650.00', direction: 'income' as const, status: 'completed' as const },
      { id: 'tx-203', merchant: 'Cloudflare', meta: 'Infrastructure · 07:31', amount: '$241.37', direction: 'expense' as const, status: 'pending' as const },
    ],
  },
  {
    label: 'Yesterday',
    transactions: [
      { id: 'tx-204', merchant: 'Metro Office', meta: 'Workspace · 17:05', amount: '$720.00', direction: 'expense' as const, status: 'completed' as const },
      { id: 'tx-205', merchant: 'Card verification', meta: 'Verification · 13:21', amount: '$0.00', direction: 'expense' as const, status: 'failed' as const },
    ],
  },
];

export const transactionDetailFixture = {
  id: 'tx-202',
  amount: '$3,650.00',
  status: 'Completed',
  merchant: 'Atlas Consulting',
  timestamp: 'Aug 22, 2026 · 08:10',
  paymentMethod: 'Business checking · •• 2048',
  reference: 'BEE-2026-08-22-0202',
  category: 'Client payment',
  description: 'August strategy engagement',
};

export const walletFixture = {
  balance: '$24,860.00',
  available: '$23,940.00',
  accounts: [
    { id: 'acc-1', name: 'Business checking', detail: '•• 2048 · Primary', balance: '$18,450.00' },
    { id: 'acc-2', name: 'Reserve', detail: '•• 9031 · Savings', balance: '$6,410.00' },
  ],
  recent: transactionGroupsFixture[0].transactions.slice(0, 2),
};

export const paymentMethodsFixture = [
  { id: 'pm-1', label: 'Visa ending 4242', detail: 'Expires 11/29', isDefault: true, state: 'active' as const },
  { id: 'pm-2', label: 'Business Mastercard ending 0088', detail: 'Expires 02/27', isDefault: false, state: 'active' as const },
  { id: 'pm-3', label: 'Corporate card ending 9910', detail: 'Expired 07/26', isDefault: false, state: 'problem' as const },
];

export const subscriptionFixture = {
  planName: 'Scale',
  price: '$79 / month',
  billingCycle: 'Monthly',
  renewalDate: 'Sep 22, 2026',
  usageLabel: 'Automations',
  usageValue: 82,
  usageText: '8,200 of 10,000 runs',
  benefits: ['Unlimited team members', 'Advanced analytics', 'Priority support', 'Custom exports'],
};

export const invoiceFixture = {
  number: 'INV-2026-1842',
  status: 'Paid',
  issueDate: 'Aug 1, 2026',
  dueDate: 'Aug 15, 2026',
  company: 'Northstar Studio LLC',
  customer: 'Atlas Consulting GmbH',
  lineItems: [
    { id: 'line-1', label: 'Product strategy retainer', quantity: '1', amount: '$3,200.00' },
    { id: 'line-2', label: 'Analytics workshop', quantity: '1', amount: '$600.00' },
  ],
  subtotal: '$3,800.00',
  tax: '$0.00',
  total: '$3,800.00',
  paymentStatus: 'Paid Aug 12, 2026',
};
