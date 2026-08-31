import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { RoutePlaceholder } from '../../../../src/shell/route-placeholder';

export default function RecordDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <RoutePlaceholder
      description={`The read/edit detail flow for record "${id}" lands here`}
      issue="#261"
      title="Record detail"
    />
  );
}
