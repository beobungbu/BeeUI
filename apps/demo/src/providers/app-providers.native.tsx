import { SheetProvider } from '@beemvp/beeui-ui';
import * as React from 'react';

/**
 * Native Sheet integration lives in BeeUI's public `SheetProvider` (#619).
 * The demo root mounts this wrapper below `BeeUIProvider`, keeping gorhom's
 * modal host below BeeUI runtime contexts by construction.
 */
export function AppProviders({ children }: { children?: React.ReactNode }) {
  return <SheetProvider>{children}</SheetProvider>;
}
