import * as React from 'react';
import type { ToastApi } from './toast';

export type ToastRuntimeSnapshot = {
  api: ToastApi;
  registerLocalViewport: () => () => void;
  renderViewport: (testID: string) => React.ReactNode;
};

const ToastApiContext = React.createContext<ToastApi | null>(null);
const ToastRuntimeContext = React.createContext<ToastRuntimeSnapshot | null>(null);

export function ToastRuntimeBoundary({
  children,
  snapshot,
}: {
  children?: React.ReactNode;
  snapshot: ToastRuntimeSnapshot;
}) {
  return (
    <ToastApiContext.Provider value={snapshot.api}>
      <ToastRuntimeContext.Provider value={snapshot}>{children}</ToastRuntimeContext.Provider>
    </ToastApiContext.Provider>
  );
}

export function useToastApiContext(): ToastApi | null {
  return React.useContext(ToastApiContext);
}

export function useToastRuntimeSnapshot(): ToastRuntimeSnapshot | null {
  return React.useContext(ToastRuntimeContext);
}

export function ToastRuntimeBridge({
  children,
  snapshot,
}: {
  children?: React.ReactNode;
  snapshot: ToastRuntimeSnapshot | null;
}) {
  if (!snapshot) return <>{children}</>;
  return <ToastRuntimeBoundary snapshot={snapshot}>{children}</ToastRuntimeBoundary>;
}

export function ToastRuntimeLocalViewport({ snapshot }: { snapshot: ToastRuntimeSnapshot | null }) {
  const registerLocalViewport = snapshot?.registerLocalViewport;
  React.useLayoutEffect(() => registerLocalViewport?.(), [registerLocalViewport]);
  return snapshot ? <>{snapshot.renderViewport('beeui-toast-local-viewport')}</> : null;
}
