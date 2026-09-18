import { Platform } from 'react-native';

type WebFocusableElement = {
  contains: (other: WebFocusableElement | null) => boolean;
  focus: (options?: { preventScroll?: boolean }) => void;
  getAttribute: (name: string) => string | null;
  getClientRects: () => ArrayLike<unknown>;
  hasAttribute: (name: string) => boolean;
  querySelectorAll: (selectors: string) => ArrayLike<WebFocusableElement>;
  removeAttribute: (name: string) => void;
  setAttribute: (name: string, value: string) => void;
};

type WebMutationObserverLike = {
  disconnect: () => void;
  observe: (
    target: WebFocusableElement,
    options: { attributeFilter?: string[]; attributes?: boolean },
  ) => void;
};

type WebMutationObserverConstructor = new (callback: () => void) => WebMutationObserverLike;

export function getWebMutationObserverConstructor(): WebMutationObserverConstructor | undefined {
  if (Platform.OS !== 'web') return undefined;
  return (globalThis as { MutationObserver?: WebMutationObserverConstructor }).MutationObserver;
}

/**
 * Corrects `node`'s `role` attribute to `'alertdialog'` immediately, then keeps
 * correcting it for as long as the returned cleanup function is not called —
 * countering react-native-web's `Modal` owner, which recomputes its own forced
 * `role` (`'dialog'` once open, `null` once closed) from an internal `active`
 * boolean it flips asynchronously (on the `animationend` DOM event for every
 * animated `animationType`, not on mount), with no prop this component can
 * pass to change what that specific node renders instead. A `MutationObserver`
 * reacts to that write whenever it actually happens, so this stays correct
 * regardless of `animationType`/timing, instead of racing a fixed delay.
 * Lives in its own internal module (not a package subpath) so it stays
 * unit-testable without becoming part of the public `./dialog` surface.
 */
export function watchAlertDialogRole(
  node: WebFocusableElement,
  MutationObserverCtor: WebMutationObserverConstructor,
): () => void {
  const enforceAlertDialogRole = () => {
    if (node.getAttribute('role') !== 'alertdialog') {
      node.setAttribute('role', 'alertdialog');
    }
  };

  enforceAlertDialogRole();
  const observer = new MutationObserverCtor(enforceAlertDialogRole);
  observer.observe(node, { attributeFilter: ['role'], attributes: true });
  return () => observer.disconnect();
}
