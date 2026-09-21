import * as React from 'react';
export type ToastRuntimeSnapshot = {
  // Kept opaque here so this internal bridge has no dependency back on the public
  // toast module. ToastRuntimeProvider is the sole writer and useToast() casts the
  // value back to ToastApi at the public boundary.
  api: unknown;
  registerLocalViewport: (id: string) => () => void;
  renderViewport: (testID: string) => React.ReactNode;
  topLocalViewportId: string | null;
};

const ToastApiContext = React.createContext<unknown>(null);
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

export function useToastApiContext(): unknown {
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

export function ToastRuntimeLocalViewport({
  active = true,
  snapshot,
}: {
  active?: boolean;
  snapshot: ToastRuntimeSnapshot | null;
}) {
  const viewportId = React.useId().replace(/:/g, '');
  const registerLocalViewport = snapshot?.registerLocalViewport;

  React.useLayoutEffect(() => {
    if (!active || !registerLocalViewport) return undefined;
    return registerLocalViewport(viewportId);
  }, [active, registerLocalViewport, viewportId]);

  if (!active || !snapshot || snapshot.topLocalViewportId !== viewportId) return null;
  return <>{snapshot.renderViewport('beeui-toast-local-viewport')}</>;
}
