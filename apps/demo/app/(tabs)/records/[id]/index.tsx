import * as React from 'react';
import { RecordDetailScreen } from '../../../../src/features/record-detail/record-detail-screen';
import { getAllTickets } from '../../../../src/features/records/tickets-data';

// Public `web.output=static` needs every known dynamic record route at build time.
// Source the ids from the same mock-service fixture the table/detail screens use;
// do not maintain a second route list for deployment.
export function generateStaticParams() {
  return getAllTickets().map((ticket) => ({ id: ticket.id }));
}

export default function RecordDetailRoute() {
  return <RecordDetailScreen />;
}
