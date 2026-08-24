import type { OverlayDismissReason } from '@beeui/core';

export type OverlayPlatformDismissHandler = (reason: OverlayDismissReason) => boolean;

type KeyboardEventLike = {
  key?: string;
  preventDefault?: () => void;
  stopPropagation?: () => void;
  stopImmediatePropagation?: () => void;
};

type GlobalEventTargetLike = {
  addEventListener?: (type: string, listener: (event: KeyboardEventLike) => void) => void;
  removeEventListener?: (type: string, listener: (event: KeyboardEventLike) => void) => void;
};

export function subscribeOverlayPlatformDismiss(handler: OverlayPlatformDismissHandler) {
  const target = globalThis as typeof globalThis & GlobalEventTargetLike;
  if (!target.addEventListener || !target.removeEventListener) return () => undefined;

  const listener = (event: KeyboardEventLike) => {
    if (event.key !== 'Escape') return;
    // Each runtime dispatches only to its own active-scope coordinator, so this
    // handler can only dismiss this runtime's overlays. When it actually handles
    // the Escape, stop immediate propagation so a *sibling* runtime's keydown
    // listener on the same target does not also process it (plain stopPropagation
    // does not stop other listeners on the same target). If this runtime has
    // nothing to dismiss, the event is left for another runtime to handle.
    if (!handler('escape')) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
  };

  target.addEventListener('keydown', listener);
  return () => target.removeEventListener?.('keydown', listener);
}
