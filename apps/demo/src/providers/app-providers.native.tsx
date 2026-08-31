import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * Native app-root providers. `Sheet`'s native implementation (#158, ADR-006)
 * requires: `Sheet` wraps the optional `@gorhom/bottom-sheet` adapter, which
 * requires both `GestureHandlerRootView` (react-native-gesture-handler) and
 * `BottomSheetModalProvider` near the app root — an unavoidable upstream
 * integration cost of the chosen engine, not a BeeUI-invented requirement.
 * Copied verbatim from `apps/showcase/app-providers.native.tsx` (ADR-013 D2)
 * — the accepted shape for any native consumer app rendering `Sheet`.
 *
 * This file only exists for `ios`/`android` (Metro's `.native.tsx` platform
 * resolution never selects it for `web`) — see `app-providers.web.tsx` for
 * why Web renders neither of these providers, nor even loads their modules.
 */
export function AppProviders({ children }: { children?: React.ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
