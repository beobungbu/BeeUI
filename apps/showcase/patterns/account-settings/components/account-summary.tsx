import { Badge, ListGroup, ListGroupHeader, SettingsItem } from '@beemvp/beeui-ui';
import * as React from 'react';

export type AccountSummaryProps = {
  displayName: string;
  email: string;
  phone?: string;
  status: 'active' | 'limited' | 'pending';
  username: string;
};

const statusLabel = {
  active: 'Active',
  limited: 'Limited',
  pending: 'Pending',
} as const;

export function AccountSummary({ displayName, email, phone, status, username }: AccountSummaryProps) {
  return (
    <ListGroup>
      <ListGroupHeader
        title={displayName}
        description={`@${username}`}
        trailing={
          <Badge variant={status === 'active' ? 'success' : status === 'pending' ? 'warning' : 'outline'}>
            {statusLabel[status]}
          </Badge>
        }
      />
      <SettingsItem title="Email" value={email} />
      {phone ? <SettingsItem title="Phone" value={phone} /> : null}
    </ListGroup>
  );
}
