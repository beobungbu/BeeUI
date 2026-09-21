import { SheetProvider } from '@beemvp/beeui-ui';
import * as React from 'react';

/**
 * Native Sheet integration lives in BeeUI's public `SheetProvider` (#619).
 * `App.tsx` mounts this platform wrapper below `BeeUIProvider`, which keeps
 * gorhom's modal host below BeeUI's safe-area/overlay/toast runtime.
 */
export function AppProviders({ children }: { children?: React.ReactNode }) {
  return <SheetProvider>{children}</SheetProvider>;
}
