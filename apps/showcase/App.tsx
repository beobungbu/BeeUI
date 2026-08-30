import './global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { BeeUIProvider } from '@beeui/ui';
import * as React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ShowcaseRoot } from './showcase-root';

// `Sheet`'s native implementation (#158, ADR-006) wraps the optional
// `@gorhom/bottom-sheet` adapter, which requires both `GestureHandlerRootView`
// (react-native-gesture-handler) and `BottomSheetModalProvider` near the app
// root — an unavoidable upstream integration cost of the chosen engine, not a
// BeeUI-invented requirement. Any consumer app rendering `Sheet` needs this
// same wiring (see `docs/components.md`'s "Sheet boundary" native section).
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BeeUIProvider>
        <BottomSheetModalProvider>
          <ShowcaseRoot />
        </BottomSheetModalProvider>
      </BeeUIProvider>
    </GestureHandlerRootView>
  );
}
