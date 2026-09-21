import * as React from 'react';

// Context is intentionally type-erased: the bridge preserves exact object/value identity
// and never interprets consumer-owned values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SheetBridgeContext = React.Context<any>;

export const EMPTY_SHEET_BRIDGE_CONTEXTS: readonly SheetBridgeContext[] = [];

type CaptureProps = {
  children: (values: readonly unknown[]) => React.ReactNode;
  contexts: readonly SheetBridgeContext[];
  index?: number;
  values?: readonly unknown[];
};

export function SheetBridgeContextCapture({
  children,
  contexts,
  index = 0,
  values = [],
}: CaptureProps): React.ReactElement {
  const context = contexts[index];
  if (!context) return <>{children(values)}</>;
  return (
    <SheetBridgeContextValueCapture
      context={context}
      contexts={contexts}
      index={index}
      values={values}
    >
      {children}
    </SheetBridgeContextValueCapture>
  );
}

function SheetBridgeContextValueCapture({
  children,
  context,
  contexts,
  index = 0,
  values = [],
}: CaptureProps & { context: SheetBridgeContext }): React.ReactElement {
  const value = React.useContext(context);
  return (
    <SheetBridgeContextCapture contexts={contexts} index={index + 1} values={[...values, value]}>
      {children}
    </SheetBridgeContextCapture>
  );
}

export function SheetConsumerContextBridge({
  bridgeContexts,
  bridgeValues,
  children,
}: {
  bridgeContexts: readonly SheetBridgeContext[];
  bridgeValues: readonly unknown[];
  children?: React.ReactNode;
}) {
  let node = children;
  for (let index = bridgeContexts.length - 1; index >= 0; index -= 1) {
    const Context = bridgeContexts[index];
    if (!Context) continue;
    node = React.createElement(Context.Provider, { value: bridgeValues[index] }, node);
  }
  return <>{node}</>;
}
