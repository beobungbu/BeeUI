import './global.css';

import { BeeUIProvider } from '@beeui/ui';
import * as React from 'react';
import { ShowcaseRoot } from './showcase-root';

export default function App() {
  return (
    <BeeUIProvider>
      <ShowcaseRoot />
    </BeeUIProvider>
  );
}
