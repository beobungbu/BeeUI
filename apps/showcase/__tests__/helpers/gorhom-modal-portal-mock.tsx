import type * as React from 'react';

/**
 * Topology-faithful `@gorhom/bottom-sheet` modal mock for native Sheet provider tests.
 *
 * The global mock in `jest.setup.ts` renders `BottomSheetModal` children in place and
 * never throws without a provider, so it cannot see provider-topology failures. This
 * mock keeps gorhom's own physics out of Jest but reproduces the three facts of
 * `@gorhom/bottom-sheet@5.2.14` that decide where Sheet content ends up:
 *
 * - `BottomSheetModal` reads `useBottomSheetModalInternal()` without `unsafe`, which
 *   throws when no `BottomSheetModalProvider` is above it
 *   (`src/components/bottomSheetModal/BottomSheetModal.tsx:72-78`,
 *   `src/hooks/useBottomSheetModalInternal.ts`).
 * - `BottomSheetModalProvider` wraps its children in the real `@gorhom/portal`
 *   `PortalProvider`, whose root `PortalHost` is a sibling rendered after the children
 *   (`src/components/bottomSheetModalProvider/BottomSheetModalProvider.tsx:202-210`,
 *   `@gorhom/portal/src/components/portalProvider/PortalProvider.tsx:18-21`).
 * - A presented modal renders its children through the real `@gorhom/portal` `Portal`
 *   into that host (`BottomSheetModal.tsx:536-544`), so they mount under the provider,
 *   not under `SheetContent`.
 */
export function createGorhomModalPortalMock() {
  const ReactActual: typeof React = require('react');
  const { View } = require('react-native');
  const path = require('path');
  const gorhomRoot = path.dirname(require.resolve('@gorhom/bottom-sheet/package.json'));
  const { Portal, PortalProvider } = require(
    require.resolve('@gorhom/portal', { paths: [gorhomRoot] }),
  );

  const HOST_NAME = 'mock-gorhom-modal-host';
  const BottomSheetModalInternalContext = ReactActual.createContext<{ hostName: string } | null>(
    null,
  );

  function useBottomSheetModalInternal(unsafe?: boolean) {
    const context = ReactActual.useContext(BottomSheetModalInternalContext);
    if (unsafe !== true && context === null) {
      throw "'BottomSheetModalInternalContext' cannot be null!";
    }
    return context;
  }

  function BottomSheetModalProvider({ children }: { children?: React.ReactNode }) {
    return (
      <BottomSheetModalInternalContext.Provider value={{ hostName: HOST_NAME }}>
        <PortalProvider rootHostName={HOST_NAME}>{children}</PortalProvider>
      </BottomSheetModalInternalContext.Provider>
    );
  }

  const BottomSheetModal = ReactActual.forwardRef(
    (props: { children?: React.ReactNode; onDismiss?: () => void }, ref: React.Ref<unknown>) => {
      const { hostName } = useBottomSheetModalInternal() as { hostName: string };
      const [mount, setMount] = ReactActual.useState(false);
      const onDismissRef = ReactActual.useRef(props.onDismiss);
      onDismissRef.current = props.onDismiss;
      ReactActual.useImperativeHandle(ref, () => ({
        dismiss: () => {
          setMount(false);
          onDismissRef.current?.();
        },
        present: () => setMount(true),
      }));
      if (!mount) return null;
      return (
        <Portal hostName={hostName}>
          <View testID="mock-gorhom-presented-modal">{props.children}</View>
        </Portal>
      );
    },
  );

  const BottomSheetView = ({ children }: { children?: React.ReactNode }) => (
    <View>{children}</View>
  );

  return {
    __esModule: true,
    BottomSheetModal,
    BottomSheetModalProvider,
    BottomSheetView,
    useBottomSheetModalInternal,
  };
}

/**
 * `react-native-teleport@1.1.13` requires its `PortalProvider` above every `PortalHost`
 * and `Portal`: both call `usePortalManagerContext()`, which throws this exact message
 * (`src/contexts/PortalManager.tsx:34-38`, `src/components/PortalHost.tsx:28-29`). The
 * host view itself is native-only, so the mock renders content in place (the library
 * keeps teleported content in its source fiber tree) and keeps only the provider guard.
 */
export function createTeleportProviderGuardMock() {
  const ReactActual: typeof React = require('react');
  const PortalManagerContext = ReactActual.createContext<object | null>(null);

  function usePortalManagerContext() {
    const context = ReactActual.useContext(PortalManagerContext);
    if (!context) throw new Error('usePortalContext must be used within PortalProvider');
    return context;
  }

  function PortalProvider({ children }: { children?: React.ReactNode }) {
    const value = ReactActual.useMemo(() => ({}), []);
    return (
      <PortalManagerContext.Provider value={value}>{children}</PortalManagerContext.Provider>
    );
  }

  function PortalHost(_props: { name: string }) {
    usePortalManagerContext();
    return null;
  }

  function Portal({ children }: { children?: React.ReactNode; hostName?: string }) {
    usePortalManagerContext();
    return <>{children}</>;
  }

  return { __esModule: true, Portal, PortalHost, PortalProvider };
}
