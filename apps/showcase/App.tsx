import './global.css';

import { BeeUIProvider } from '@beemvp/beeui-ui';
import * as React from 'react';
import { AppProviders } from './app-providers';
import { PublicShowcaseRouter } from './public-showcase-router';

// `AppProviders` is platform-split (`app-providers.native.tsx` /
// `app-providers.web.tsx`): native wraps `Sheet`'s required
// `GestureHandlerRootView`/`BottomSheetModalProvider`; Web is a pure passthrough.
// Public URL routing is also platform-split: native stays router-free while Web
// accepts stable launch-site query identities for docs/Showcase deep links.
export default function App() {
  return (
    <BeeUIProvider>
      <AppProviders>
        <PublicShowcaseRouter />
      </AppProviders>
    </BeeUIProvider>
  );
}
