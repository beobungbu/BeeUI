import { EmptyState, KeyboardAwareScreen } from '@beemvp/beeui-ui';
import * as React from 'react';

export type RoutePlaceholderProps = {
  description: string;
  issue: string;
  title: string;
};

/**
 * Placeholder body for a route owned by a later lane (#259-263). Each lane
 * replaces its own route file's contents entirely — this component exists
 * only so `#258`'s shell has something real (not a blank screen) to route to
 * while proving the nav shell works end to end.
 */
export function RoutePlaceholder({ description, issue, title }: RoutePlaceholderProps) {
  return (
    <KeyboardAwareScreen contentWidth="lg">
      <EmptyState description={`${description} (tracked by ${issue}).`} title={title} />
    </KeyboardAwareScreen>
  );
}
