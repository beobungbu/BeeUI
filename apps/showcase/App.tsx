import './global.css';

import { BeeUIProvider } from '@beeui/ui';
import * as React from 'react';
import { AppProviders } from './app-providers';
import { ShowcaseRoot } from './showcase-root';

// `AppProviders` is platform-split (`app-providers.native.tsx` /
// `app-providers.web.tsx`): native wraps `Sheet`'s required
// `GestureHandlerRootView`/`BottomSheetModalProvider` (#158, ADR-006); Web is
// a pure passthrough that never even loads those modules. See
// `app-providers.web.tsx` for why that split is load-bearing, not cosmetic.
export default function App() {
  return (
    <BeeUIProvider>
      <AppProviders>
        <ShowcaseRoot />
      </AppProviders>
    </BeeUIProvider>
  );
}
