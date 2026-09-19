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

export type DialogOwnerRole = 'dialog' | 'alertdialog';

export function getWebMutationObserverConstructor(): WebMutationObserverConstructor | undefined {
  if (Platform.OS !== 'web') return undefined;
  return (globalThis as { MutationObserver?: WebMutationObserverConstructor }).MutationObserver;
}

/**
 * Sets `node`'s `role` attribute to `role` immediately, then keeps it there
 * for as long as the returned cleanup function is not called — countering
 * react-native-web's `Modal` owner, which recomputes its own forced `role`
 * (`'dialog'` once "active", `null` otherwise) from an internal `active`
 * boolean it flips asynchronously, with no prop this component can pass to
 * change what that specific node renders instead. That flip only happens on
 * the `animationend` DOM event for an animated `animationType` (~300ms after
 * mount for the default `fade`), or from a manual call that fires only when
 * `visible` changes while `animationType` is already `'none'` — so a Dialog
 * that opens with `fade` and switches to `none` in the same frame (the
 * reduced-motion path before the synchronous Web read in `dialog.tsx`) never
 * became "active" and never got any `role` at all. BeeUI's own accessibility
 * contract (exactly one `dialog`/`alertdialog` node, carrying the dialog's
 * accessible name, from the first open commit) must not hinge on that
 * animation bookkeeping, so this stamps the role itself and a
 * `MutationObserver` re-applies it whenever react-native-web's own write
 * lands, whatever the `animationType`/timing, instead of racing a fixed delay.
 * Lives in its own internal module (not a package subpath) so it stays
 * unit-testable without becoming part of the public `./dialog` surface.
 */
export function watchDialogOwnerRole(
  node: WebFocusableElement,
  role: DialogOwnerRole,
  MutationObserverCtor: WebMutationObserverConstructor,
): () => void {
  const enforceRole = () => {
    if (node.getAttribute('role') !== role) {
      node.setAttribute('role', role);
    }
  };

  enforceRole();
  const observer = new MutationObserverCtor(enforceRole);
  observer.observe(node, { attributeFilter: ['role'], attributes: true });
  return () => observer.disconnect();
}
