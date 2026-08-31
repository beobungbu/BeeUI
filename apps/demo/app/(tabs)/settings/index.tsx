import * as React from 'react';
import { RoutePlaceholder } from '../../../src/shell/route-placeholder';

export default function SettingsRoute() {
  return (
    <RoutePlaceholder
      description="Theme, density, direction, text-scale, and other a11y preferences land here"
      issue="#263"
      title="Settings"
    />
  );
}
