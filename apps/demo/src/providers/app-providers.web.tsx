import * as React from 'react';

/**
 * Web app-root providers: a pure passthrough. `sheet.web.tsx` (ADR-006) does
 * not use `@gorhom/bottom-sheet`/`react-native-gesture-handler` at all — Web
 * gets its own BeeUI-owned overlay engine — so this file deliberately never
 * imports either package. Metro's `.web.tsx` platform resolution means the
 * Web bundle never even loads those modules, let alone renders them. Copied
 * verbatim from `apps/showcase/app-providers.web.tsx` (ADR-013 D2): rendering
 * `GestureHandlerRootView`/`BottomSheetModalProvider` unconditionally on Web
 * has previously measurably broken unrelated Web overlay behavior (Dialog's
 * Escape-to-close focus-trap contract, #146), even though `Sheet` itself
 * never rendered them there.
 */
export function AppProviders({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
