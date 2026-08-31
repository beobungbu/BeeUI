import * as React from 'react';
import { RoutePlaceholder } from '../../src/shell/route-placeholder';

export default function DashboardRoute() {
  return (
    <RoutePlaceholder
      description="Summary metrics, activity, and status overview land here"
      issue="#259"
      title="Dashboard"
    />
  );
}
